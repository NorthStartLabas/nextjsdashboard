import os
import sys
import argparse
import json
import pandas as pd
from datetime import datetime, timedelta
import snowflake.connector
from dotenv import load_dotenv

# Add script directory to sys.path to import config
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config.config import BREAK_MAPPING

def extract_hour(time_val):
    try:
        if pd.isna(time_val):
            return -1
        val_str = str(time_val).strip()
        if val_str in ("None", "NaN", "NaT", ""):
            return -1
        if ':' in val_str:
            time_part = val_str.split()[-1]
            return int(time_part.split(':')[0])
        if '.' in val_str:
            val_str = val_str.split('.')[0]
        val_str = val_str.zfill(6)
        return int(val_str[:2])
    except Exception:
        return -1

def main():
    parser = argparse.ArgumentParser(description="Fetch historical user stats from Snowflake.")
    parser.add_argument('--qname', type=str, required=True, help="Username to search for.")
    parser.add_argument('--lgnum', type=str, required=True, choices=['245', '266'], help="LGNUM (245 for MS, 266 for CVNS).")
    parser.add_argument('--activity', type=str, default='picking', choices=['picking', 'packing'], help="Activity type.")
    args = parser.parse_args()

    qname_search = args.qname.upper()
    lgnum_search = args.lgnum
    activity = args.activity

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
        print(json.dumps({"success": False, "error": f"Failed to connect to Snowflake: {str(e)}"}))
        return

    cur = conn.cursor()

    df_final = pd.DataFrame()

    try:
        if activity == 'picking':
            columns = ['UMREZ', 'QDATU', 'QZEIT', 'QNAME', 'VLPLA', 'LGNUM']
            cols_str = ", ".join(columns)
            
            # Picking Query
            query = f"""
            SELECT {cols_str}
            FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_LTAP
            WHERE QNAME = '{qname_search}'
              AND LGNUM = '{lgnum_search}'
              AND QDATU >= '2025-01-01'
              AND VBELN IS NOT NULL
              AND NLPLA IS NOT NULL
              AND VBELN = NLPLA
            """
            cur.execute(query)
            df = pd.DataFrame(cur.fetchall(), columns=columns)
            
            if not df.empty:
                cvns_vlpla_starts = ['L', 'F', 'X', 'N', 'O', 'Y', 'W']
                cvns_vlpla_not_starts = ['YES', 'NO', 'LONGGOODS', 'NCS', 'OSO']
                ms_vlpla_starts = ['B', 'C', 'D', 'V', 'E']

                def filter_row(row):
                    vlpla = str(row['VLPLA']) if row['VLPLA'] else ""
                    if lgnum_search == '266': # CVNS
                        if not any(vlpla.startswith(s) for s in cvns_vlpla_starts): return False
                        if any(vlpla.startswith(s) for s in cvns_vlpla_not_starts): return False
                        return True
                    else: # MS (245)
                        return any(vlpla.startswith(s) for s in ms_vlpla_starts)

                df_filtered = df[df.apply(filter_row, axis=1)].copy()
                if not df_filtered.empty:
                    df_filtered['HOUR'] = df_filtered['QZEIT'].apply(extract_hour)
                    df_filtered['TOTAL_COUNT'] = 1 # Each row is 1 line
                    df_filtered['ITEMS_SUM'] = pd.to_numeric(df_filtered['UMREZ'], errors='coerce').fillna(0)
                    df_filtered['QDATU'] = pd.to_datetime(df_filtered['QDATU'])
                    df_final = df_filtered

        else: # activity == 'packing'
            # 1. Find all boxes the user touched (ZORF_BOX_CLOSING or WEBMREMOTEWS for MS)
            # For specific user history, we don't necessarily need the 5-day attribution logic 
            # as strictly as the daily monitor, but let's at least ensure we pull their own closing hits.
            
            action_filter = f"(TCODE = 'ZORF_BOX_CLOSING' OR USERNAME = 'WEBMREMOTEWS')" if lgnum_search == '245' else "TCODE = 'ZORF_BOX_CLOSING'"
            
            packing_query = f"""
            WITH USER_PACKS AS (
                SELECT OBJECTID, USERNAME, UDATE, UTIME
                FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_CDHDR
                WHERE USERNAME = '{qname_search}'
                  AND UDATE >= '20250101'
                  AND OBJECTCLAS = 'HANDL_UNIT'
                  AND {action_filter}
            ),
            PACK_EXIDV AS (
                SELECT DISTINCT VENUM, EXIDV
                FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_VEKP
                WHERE VENUM IN (SELECT OBJECTID FROM USER_PACKS)
            ),
            HU_INFO AS (
                SELECT EXIDV, LGNUM, VLTYP, ROUTE FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HU_TO_LINK
                UNION
                SELECT EXIDV, LGNUM, VLTYP, ROUTE FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HUTO_LNKHIS
            )
            SELECT 
                H.OBJECTID, H.USERNAME, H.UDATE, H.UTIME, 
                I.LGNUM, I.VLTYP, I.ROUTE
            FROM USER_PACKS H
            JOIN PACK_EXIDV E ON H.OBJECTID = E.VENUM
            JOIN HU_INFO I ON E.EXIDV = I.EXIDV
            WHERE I.LGNUM = '{lgnum_search}'
            """
            cur.execute(packing_query)
            df_pack = pd.DataFrame(cur.fetchall(), columns=['OBJECTID', 'QNAME', 'UDATE', 'UTIME', 'LGNUM', 'VLTYP', 'ROUTE'])
            
            if not df_pack.empty:
                # Basic cleanup
                df_pack['HOUR'] = df_pack['UTIME'].apply(extract_hour)
                df_pack['QDATU'] = pd.to_datetime(df_pack['UDATE'], format='%Y%m%d')
                
                # Deduplicate by OBJECTID per day (in case of double hits)
                df_pack = df_pack.drop_duplicates(subset=['OBJECTID', 'QDATU'])
                
                df_pack['TOTAL_COUNT'] = 1 # Each row is 1 box
                df_pack['ITEMS_SUM'] = 0 # No items concept in packing stats as requested
                df_final = df_pack

    except Exception as e:
        print(json.dumps({"success": False, "error": f"Query execution failed: {str(e)}"}))
        return
    finally:
        cur.close()
        conn.close()

    if df_final.empty:
        print(json.dumps({"success": False, "error": f"No {activity} data found for this user."}))
        return

    # Aggregate
    df_final['WEEK'] = df_final['QDATU'].apply(lambda x: x.isocalendar()[1])
    df_final['YEAR'] = df_final['QDATU'].apply(lambda x: x.isocalendar()[0])

    # First, aggregate by Day and Hour to calculate Effort correctly (distributed across flows/floors if needed)
    # Actually for a single user, we just need to know how many hours they worked
    # If they worked multiple contexts in one hour, we should count it as 1.0 hr total for that user.
    
    # We don't have FLOOR/FLOW info in the same way here easily because we'd need to map it
    # But for a user's *own* stats, we can just simplify: Effort = 1.0 per hour they were active.
    
    hourly_stats = df_final.groupby(['YEAR', 'WEEK', 'QDATU', 'HOUR']).agg(
        COUNT_VAL=('TOTAL_COUNT', 'sum'),
        ITEMS_VAL=('ITEMS_SUM', 'sum')
    ).reset_index()

    hourly_stats['EFFORT'] = hourly_stats['HOUR'].apply(lambda h: BREAK_MAPPING.get(h, 1.0))

    # Aggregate by Day
    daily_stats = hourly_stats.groupby(['YEAR', 'WEEK', 'QDATU']).agg(
        TOTAL_LINES=('COUNT_VAL', 'sum'),
        TOTAL_ITEMS=('ITEMS_VAL', 'sum'),
        TOTAL_EFFORT=('EFFORT', 'sum')
    ).reset_index()

    daily_stats['TOTAL_EFFORT'] = daily_stats['TOTAL_EFFORT'].round(2)
    daily_stats['RATIO'] = (daily_stats['TOTAL_ITEMS'] / daily_stats['TOTAL_LINES']).round(2) if activity == 'picking' else 0
    daily_stats['PRODUCTIVITY'] = (daily_stats['TOTAL_LINES'] / daily_stats['TOTAL_EFFORT']).round(2)
    daily_stats['DATE'] = daily_stats['QDATU'].dt.strftime('%Y-%m-%d')
    daily_stats['DAY_NAME'] = daily_stats['QDATU'].dt.day_name()
    
    daily_stats = daily_stats.sort_values(['DATE'], ascending=False)
    result_data = daily_stats.drop(columns=['QDATU']).to_dict(orient='records')
    
    print(json.dumps({
        "success": True,
        "data": result_data,
        "qname": qname_search,
        "lgnum": lgnum_search,
        "activity": activity
    }))

if __name__ == "__main__":
    main()
