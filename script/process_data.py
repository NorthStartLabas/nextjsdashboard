import os
import argparse
import pandas as pd
from datetime import datetime
import snowflake.connector
from dotenv import load_dotenv

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config.config import FLOOR_MAPPING, BREAK_MAPPING

def main():
    parser = argparse.ArgumentParser(description="Pull and transform Snowflake picking data.")
    parser.add_argument('--date', type=str, help="Date to pull data for (YYYY-MM-DD). Defaults to today.")
    args = parser.parse_args()

    target_date = args.date if args.date else datetime.today().strftime('%Y-%m-%d')
    print(f"Running data extraction for date: {target_date}")

    load_dotenv()

    try:
        conn = snowflake.connector.connect(
            user=os.getenv('user'),
            authenticator=os.getenv('authenticator'),
            account=os.getenv('account'),
            role=os.getenv('role'),
            warehouse=os.getenv('warehouse'),
            database=os.getenv('database'),
            schema=os.getenv('schema')
        )
    except Exception as e:
        print(f"Failed to connect to Snowflake: {e}")
        return

    cur = conn.cursor()

    columns = ['MATNR', 'CHARG', 'UMREZ', 'QDATU', 'QZEIT', 'QNAME', 'BRGEW', 'GEWEI', 'VLTYP', 'VLPLA', 'NLPLA', 'VBELN', 'LGNUM']
    cols_str = ", ".join(columns)

    print("Fetching base data from SDS_CP_LTAP...")
    
    cvns_vlpla_starts = ['L', 'F', 'X', 'N', 'O', 'Y', 'W']
    cvns_vlpla_not_starts = ['YES', 'NO', 'LONGGOODS', 'NCS', 'OSO']
    
    ms_vlpla_starts = ['B', 'C', 'D', 'V', 'E']

    ltap_query = f"""
    SELECT {cols_str}
    FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_LTAP
    WHERE QDATU = '{target_date}'
      AND VBELN IS NOT NULL
      AND NLPLA IS NOT NULL
      AND VBELN = NLPLA
      AND LGNUM IN ('245', '266')
    """
    
    cur.execute(ltap_query)
    rows = cur.fetchall()
    df_ltap = pd.DataFrame(rows, columns=columns)

    if df_ltap.empty:
        print(f"No data found in SDS_CP_LTAP for date {target_date}.")
        return
        
    def filter_cvns(row):
        vlpla = str(row['VLPLA']) if row['VLPLA'] else ""
        if not any(vlpla.startswith(s) for s in cvns_vlpla_starts):
            return False
        if any(vlpla.startswith(s) for s in cvns_vlpla_not_starts):
            return False
        return True

    def filter_ms(row):
        vlpla = str(row['VLPLA']) if row['VLPLA'] else ""
        return any(vlpla.startswith(s) for s in ms_vlpla_starts)
        
    df_cvns = df_ltap[df_ltap['LGNUM'] == '266']
    df_cvns = df_cvns[df_cvns.apply(filter_cvns, axis=1)]

    df_ms = df_ltap[df_ltap['LGNUM'] == '245']
    df_ms = df_ms[df_ms.apply(filter_ms, axis=1)]

    df_ltap_filtered = pd.concat([df_ms, df_cvns])
    if df_ltap_filtered.empty:
        print("No valid rows remaining after VLPLA filtering.")
        return

    unique_vbeln = df_ltap_filtered['VBELN'].unique()
    unique_vbeln_str = ", ".join([f"'{v}'" for v in unique_vbeln])
    
    print(f"Fetching route data for {len(unique_vbeln)} unique VBELN values...")

    if len(unique_vbeln) > 0:
        link_query = f"""
        SELECT VBELN, ROUTE
        FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HU_TO_LINK
        WHERE VBELN IN ({unique_vbeln_str})
        """
        cur.execute(link_query)
        df_link = pd.DataFrame(cur.fetchall(), columns=['VBELN', 'ROUTE'])

        his_query = f"""
        SELECT VBELN, ROUTE
        FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HUTO_LNKHIS
        WHERE VBELN IN ({unique_vbeln_str})
        """
        cur.execute(his_query)
        df_his = pd.DataFrame(cur.fetchall(), columns=['VBELN', 'ROUTE'])

        df_routes_db = pd.concat([df_link, df_his]).drop_duplicates(subset=['VBELN'])
    else:
        df_routes_db = pd.DataFrame(columns=['VBELN', 'ROUTE'])

    cur.close()
    conn.close()

    print("Transforming data...")
    routes_csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'routes.csv')
    try:
        df_route_mapping = pd.read_csv(routes_csv_path)
        route_to_flow = dict(zip(df_route_mapping['ROUTE'], df_route_mapping['FLOW']))
    except FileNotFoundError:
        print(f"Warning: routes.csv not found at {routes_csv_path}. Flows will be unknown.")
        route_to_flow = {}

    df_merged = pd.merge(df_ltap_filtered, df_routes_db, on='VBELN', how='left')

    def map_flow(route):
        flow = route_to_flow.get(route, 'unknown_flow')
        if flow == 'Y2-flow':
            return 'A-flow'
        return flow

    df_merged['FLOW'] = df_merged['ROUTE'].apply(map_flow)

    def extract_hour(qzeit_val):
        try:
            if pd.isna(qzeit_val):
                return -1
                
            val_str = str(qzeit_val).strip()
            if val_str in ("None", "NaN", "NaT", ""):
                return -1
                
            if ':' in val_str:
                # E.g. "14:32:00" or "0 days 14:32:00"
                time_part = val_str.split()[-1]
                return int(time_part.split(':')[0])
                
            if '.' in val_str:
                # E.g. 93000.0 -> remove decimal
                val_str = val_str.split('.')[0]
                
            # zfill to 6 digits to handle 93000 -> 093000
            val_str = val_str.zfill(6)
            return int(val_str[:2])
        except Exception:
            return -1

    df_merged['HOUR'] = df_merged['QZEIT'].apply(extract_hour)

    def map_floor(row):
        if row['LGNUM'] == '245':
            return 'ground_floor'
        else:
            vltyp = str(row['VLTYP']) if row['VLTYP'] else ""
            return FLOOR_MAPPING.get(vltyp, 'unknown_floor')

    df_merged['FLOOR'] = df_merged.apply(map_floor, axis=1)

    df_merged['UMREZ'] = pd.to_numeric(df_merged['UMREZ'], errors='coerce').fillna(0)

    print("Calculating statistics...")

    def calculate_stats(df, dept_flag):
        if df.empty:
            return pd.DataFrame(), pd.DataFrame()

        hourly_groups = df.groupby(['QNAME', 'QDATU', 'HOUR', 'FLOW', 'FLOOR'])

        hourly_stats = []
        for name, group in hourly_groups:
            qname, qdatu, hour, flow, floor = name
            lines_picked = len(group)
            items_picked = group['UMREZ'].sum()
            ratio = round(items_picked / lines_picked, 2) if lines_picked > 0 else 0.0
            
            effort = BREAK_MAPPING.get(hour, 1.0)
            productivity = round(lines_picked / effort, 2) if effort > 0 else 0.0

            hourly_stats.append({
                'QNAME': qname,
                'QDATU': qdatu,
                'HOUR': hour,
                'FLOW': flow,
                'FLOOR': floor,
                'LINES_PICKED': lines_picked,
                'ITEMS_PICKED': items_picked,
                'RATIO': ratio,
                'EFFORT': effort,
                'PRODUCTIVITY': productivity
            })

        df_hourly = pd.DataFrame(hourly_stats)

        daily_groups = df_hourly.groupby(['QNAME', 'QDATU', 'FLOW', 'FLOOR'])
        
        daily_stats = []
        for name, group in daily_groups:
            qname, qdatu, flow, floor = name
            total_lines = group['LINES_PICKED'].sum()
            total_items = group['ITEMS_PICKED'].sum()
            total_effort = group['EFFORT'].sum()
            
            daily_ratio = round(total_items / total_lines, 2) if total_lines > 0 else 0.0
            daily_productivity = round(total_lines / total_effort, 2) if total_effort > 0 else 0.0

            daily_stats.append({
                'QNAME': qname,
                'QDATU': qdatu,
                'FLOW': flow,
                'FLOOR': floor,
                'LINES_PICKED': total_lines,
                'ITEMS_PICKED': total_items,
                'RATIO': daily_ratio,
                'EFFORT': total_effort,
                'PRODUCTIVITY': daily_productivity
            })

        df_daily = pd.DataFrame(daily_stats)

        return df_hourly, df_daily

    df_ms_final = df_merged[df_merged['LGNUM'] == '245']
    df_cvns_final = df_merged[df_merged['LGNUM'] == '266']

    ms_hourly, ms_daily = calculate_stats(df_ms_final, 'MS')
    cvns_hourly, cvns_daily = calculate_stats(df_cvns_final, 'CVNS')

    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
    os.makedirs(output_dir, exist_ok=True)

    if not ms_hourly.empty:
        ms_hourly.to_csv(os.path.join(output_dir, 'ms_hourly_stats.csv'), index=False)
        ms_daily.to_csv(os.path.join(output_dir, 'ms_daily_stats.csv'), index=False)
        print("Generated MS stats.")
    
    if not cvns_hourly.empty:
        cvns_hourly.to_csv(os.path.join(output_dir, 'cvns_hourly_stats.csv'), index=False)
        cvns_daily.to_csv(os.path.join(output_dir, 'cvns_daily_stats.csv'), index=False)
        print("Generated CVNS stats.")
        
    print("Done!")

if __name__ == "__main__":
    main()
