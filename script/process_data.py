import os
import argparse
import pandas as pd
import json
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

    # Connection parameters
    conn_params = {
        'user': os.getenv('user'),
        'account': os.getenv('account'),
        'role': os.getenv('role'),
        'warehouse': os.getenv('warehouse'),
        'database': os.getenv('database'),
        'schema': os.getenv('schema')
    }

    # Use Programmatic Access Token if available, otherwise fallback to configured authenticator
    token = os.getenv('SNOWFLAKE_TOKEN')
    if token:
        conn_params['authenticator'] = 'oauth'
        conn_params['token'] = token
    else:
        conn_params['authenticator'] = os.getenv('authenticator')

    try:
        conn = snowflake.connector.connect(**conn_params)
    except Exception as e:
        print(f"Failed to connect to Snowflake: {e}")
        return

    cur = conn.cursor()

    # --- SHARED ROUTE MAPPING ---
    routes_csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'routes.csv')
    try:
        df_route_mapping = pd.read_csv(routes_csv_path)
        route_to_flow = dict(zip(df_route_mapping['ROUTE'], df_route_mapping['FLOW']))
        b_flow_routes = df_route_mapping[df_route_mapping['FLOW'] == 'B-flow']['ROUTE'].unique()
    except FileNotFoundError:
        print(f"Warning: routes.csv not found at {routes_csv_path}.")
        route_to_flow = {}
        b_flow_routes = []

    # --- B-FLOW DELIVERY EXTRACTION (FOR DASHBOARD) ---
    actual_today = datetime.today().strftime('%Y-%m-%d')
    if len(b_flow_routes) > 0:
        b_routes_str = ", ".join([f"'{r}'" for r in b_flow_routes])
        vstel_list = "'1NLA', '2NLA', '3NLA', '4NLA'"
        
        scenarios = [
            {"name": "today", "sql_cond": f"= '{actual_today}'", "suffix": ""},
            {"name": "backlog", "sql_cond": f"< '{actual_today}'", "suffix": "_backlog"},
            {"name": "future", "sql_cond": f"> '{actual_today}'", "suffix": "_future"}
        ]
        
        for scenario in scenarios:
            print(f"Processing B-FLOW {scenario['name']} deliveries (WADAT {scenario['sql_cond']})...")
            
            likp_query = f"""
            SELECT LGNUM, LPRIO, WAUHR, VBELN
            FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_LIKP
            WHERE ROUTE IN ({b_routes_str})
              AND WADAT {scenario['sql_cond']}
              AND WADAT_IST IS NULL
              AND (
                (LGNUM = '266' AND VSTEL IN ({vstel_list}))
                OR (LGNUM = '245')
              )
            """
            try:
                cur.execute(likp_query)
                rows_likp = cur.fetchall()
                df_likp_all = pd.DataFrame(rows_likp, columns=['LGNUM', 'LPRIO', 'WAUHR', 'VBELN'])
                
                # --- CLOSED TODAY EXTRACTION (NEW) ---
                df_closed_all = pd.DataFrame()
                df_ltap_closed_all = pd.DataFrame()
                df_hu_closed_all = pd.DataFrame()

                if scenario['name'] == 'today':
                    print("Fetching deliveries closed (PGI'd) today...")
                    closed_query = f"""
                    SELECT LGNUM, LPRIO, WAUHR, VBELN
                    FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_LIKP
                    WHERE ROUTE IN ({b_routes_str})
                      AND WADAT_IST = '{actual_today}'
                      AND (
                        (LGNUM = '266' AND VSTEL IN ({vstel_list}))
                        OR (LGNUM = '245')
                      )
                    """
                    cur.execute(closed_query)
                    df_closed_all = pd.DataFrame(cur.fetchall(), columns=['LGNUM', 'LPRIO', 'WAUHR', 'VBELN'])
                    
                    if not df_closed_all.empty:
                        closed_vbelns = df_closed_all['VBELN'].unique()
                        c_chunks = [closed_vbelns[i:i + 1000] for i in range(0, len(closed_vbelns), 1000)]
                        
                        ltap_c_rows = []
                        hu_c_rows = []
                        ltap_cols = ['LGNUM', 'VBELN', 'VLPLA', 'VLTYP', 'NLPLA', 'QDATU', 'KOBER', 'NISTA', 'BRGEW', 'VOLUM', 'VSOLA']
                        
                        for chunk in c_chunks:
                            c_str = ", ".join([f"'{v}'" for v in chunk])
                            # LTAP for closed
                            cur.execute(f"SELECT {', '.join(ltap_cols)} FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_LTAP WHERE VBELN IN ({c_str}) AND NLPLA IS NOT NULL AND VBELN = NLPLA AND LGNUM IN ('245', '266')")
                            ltap_c_rows.extend(cur.fetchall())
                            # HU for closed
                            cur.execute(f"SELECT VBELN, EXIDV FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HU_TO_LINK WHERE VBELN IN ({c_str}) UNION SELECT VBELN, EXIDV FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HUTO_LNKHIS WHERE VBELN IN ({c_str})")
                            hu_c_rows.extend(cur.fetchall())
                        
                        df_ltap_closed_all = pd.DataFrame(ltap_c_rows, columns=ltap_cols)
                        df_hu_closed_all = pd.DataFrame(hu_c_rows, columns=['VBELN', 'EXIDV'])
                        
                        # Convert numeric
                        for col in ['NISTA', 'BRGEW', 'VOLUM', 'VSOLA']:
                            df_ltap_closed_all[col] = pd.to_numeric(df_ltap_closed_all[col], errors='coerce').fillna(0)
                        
                        # Strip zeros
                        df_closed_all['VBELN'] = df_closed_all['VBELN'].astype(str).str.strip().str.lstrip('0')
                        df_ltap_closed_all['VBELN'] = df_ltap_closed_all['VBELN'].astype(str).str.strip().str.lstrip('0')
                        df_hu_closed_all['VBELN'] = df_hu_closed_all['VBELN'].astype(str).str.strip().str.lstrip('0')

                if not df_likp_all.empty or not df_closed_all.empty:
                    # --- LTAP EXTRACTION FOR THESE VBELNs ---
                    unique_vbeln_list = df_likp_all['VBELN'].unique()
                    vbeln_chunks = [unique_vbeln_list[i:i + 1000] for i in range(0, len(unique_vbeln_list), 1000)]
                    
                    ltap_dashboard_rows = []
                    ltap_cols = ['LGNUM', 'VBELN', 'VLPLA', 'VLTYP', 'NLPLA', 'QDATU', 'KOBER', 'NISTA', 'BRGEW', 'VOLUM', 'TANUM', 'VSOLA']
                    
                    for chunk in vbeln_chunks:
                        chunk_str = ", ".join([f"'{v}'" for v in chunk])
                        detail_query = f"""
                        SELECT {', '.join(ltap_cols)}
                        FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_LTAP
                        WHERE VBELN IN ({chunk_str})
                          AND NLPLA IS NOT NULL
                          AND VBELN = NLPLA
                          AND LGNUM IN ('245', '266')
                        """
                        cur.execute(detail_query)
                        ltap_dashboard_rows.extend(cur.fetchall())
                    
                    df_ltap_dash = pd.DataFrame(ltap_dashboard_rows, columns=ltap_cols)

                    # --- HU EXTRACTION FOR THESE VBELNs ---
                    hu_dashboard_rows = []
                    for chunk in vbeln_chunks:
                        chunk_str = ", ".join([f"'{v}'" for v in chunk])
                        hu_query = f"""
                        SELECT VBELN, EXIDV, VLTYP, TANUM
                        FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HU_TO_LINK
                        WHERE VBELN IN ({chunk_str})
                        UNION
                        SELECT VBELN, EXIDV, VLTYP, TANUM
                        FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HUTO_LNKHIS
                        WHERE VBELN IN ({chunk_str})
                        """
                        cur.execute(hu_query)
                        hu_dashboard_rows.extend(cur.fetchall())
                    df_hu_dash = pd.DataFrame(hu_dashboard_rows, columns=['VBELN', 'EXIDV', 'VLTYP', 'TANUM'])
                    df_hu_dash['VBELN'] = df_hu_dash['VBELN'].astype(str).str.strip().str.lstrip('0')
                    df_hu_dash['TANUM'] = df_hu_dash['TANUM'].astype(str).str.strip()
                    
                    # --- HU PRIORITY GROUP EXTRACTION ---
                    hu_list = df_hu_dash['EXIDV'].unique()
                    df_prio_grp = pd.DataFrame(columns=['EXIDV', 'ZEXIDVGRP', 'PICKINIUSER'])
                    if len(hu_list) > 0:
                        hu_chunks = [hu_list[i:i + 1000] for i in range(0, len(hu_list), 1000)]
                        prio_grp_rows = []
                        for chunk in hu_chunks:
                            # Pad to 20 digits so Snowflake matches the full barcode in ZORF_HU_PRIOGRP
                            chunk_str = ", ".join([f"'{str(v).strip().zfill(20)}'" for v in chunk])
                            prio_grp_query = f"""
                            SELECT EXIDV, ZEXIDVGRP, PICKINIUSER 
                            FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HU_PRIOGRP 
                            WHERE EXIDV IN ({chunk_str})
                            """
                            cur.execute(prio_grp_query)
                            prio_grp_rows.extend(cur.fetchall())
                        if prio_grp_rows:
                            df_prio_grp = pd.DataFrame(prio_grp_rows, columns=['EXIDV', 'ZEXIDVGRP', 'PICKINIUSER'])
                            df_prio_grp['EXIDV'] = df_prio_grp['EXIDV'].astype(str).str.strip()
                    
                    # Convert numeric columns
                    for col in ['NISTA', 'BRGEW', 'VOLUM', 'VSOLA']:
                        df_ltap_dash[col] = pd.to_numeric(df_ltap_dash[col], errors='coerce').fillna(0)

                    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
                    os.makedirs(output_dir, exist_ok=True)
                    
                    suffix = scenario['suffix']
                    dept_mapping = {
                        '245': f'dashboard_data_ms{suffix}.json', 
                        '266': f'dashboard_data_cvns{suffix}.json'
                    }
                    
                    for lgnum, filename in dept_mapping.items():
                        df_likp_dept = df_likp_all[df_likp_all['LGNUM'] == lgnum]
                        df_ltap_dept = df_ltap_dash[df_ltap_dash['LGNUM'] == lgnum].copy()
                        df_hu_dept = df_hu_dash[df_hu_dash['VBELN'].isin(df_likp_dept['VBELN'])].copy()
                        
                        # Apply specific filters
                        if lgnum == '266': # CVNS
                            cvns_starts = ['L', 'F', 'X', 'N', 'O', 'Y', 'W']
                            cvns_not_starts = ['YES', 'NO', 'LONGGOODS', 'NCS', 'OSO']
                            def filter_cvns_local(row):
                                v = str(row['VLPLA']) if row['VLPLA'] else ""
                                return any(v.startswith(s) for s in cvns_starts) and not any(v.startswith(s) for s in cvns_not_starts)
                            df_ltap_dept = df_ltap_dept[df_ltap_dept.apply(filter_cvns_local, axis=1)]
                        else: # MS (245)
                            ms_starts = ['B', 'C', 'D', 'V', 'E']
                            def filter_ms_local(row):
                                v = str(row['VLPLA']) if row['VLPLA'] else ""
                                vltyp = str(row['VLTYP']) if row['VLTYP'] else ""
                                return any(v.startswith(s) for s in ms_starts) and vltyp != 'REP'
                            df_ltap_dept = df_ltap_dept[df_ltap_dept.apply(filter_ms_local, axis=1)]

                        # Metrics helper
                        def get_metrics_local(df):
                            picked = df[df['QDATU'].notnull()]
                            not_picked = df[df['QDATU'].isnull()]
                            def agg(d, qty_col):
                                return {
                                    "lines": int(len(d)),
                                    "items": int(d[qty_col].sum()),
                                    "requested_items": int(d['VSOLA'].sum()),
                                    "kg": round(float(d['BRGEW'].sum()), 2),
                                    "vol": round(float(d['VOLUM'].sum()), 2)
                                }
                            return {
                                "total": agg(df, 'VSOLA'),
                                "picked": agg(picked, 'NISTA'),
                                "not_picked": agg(not_picked, 'VSOLA')
                            }

                        # Ensure VBELN is string and stripped of leading zeros for consistent mapping
                        df_ltap_dept['VBELN'] = df_ltap_dept['VBELN'].astype(str).str.strip().str.lstrip('0')
                        df_likp_dept['VBELN'] = df_likp_dept['VBELN'].astype(str).str.strip().str.lstrip('0')
                        df_hu_dept['VBELN'] = df_hu_dept['VBELN'].astype(str).str.strip().str.lstrip('0')

                        # Merge LTAP with LIKP to get WAUHR/LPRIO context for metrics
                        df_ltap_merged = pd.merge(
                            df_ltap_dept, 
                            df_likp_dept[['VBELN', 'LPRIO', 'WAUHR']], 
                            on='VBELN', 
                            how='left'
                        )
                        
                        # Merge HU with LIKP
                        df_hu_merged = pd.merge(
                            df_hu_dept,
                            df_likp_dept[['VBELN', 'LPRIO', 'WAUHR']],
                            on='VBELN',
                            how='left'
                        )
                        
                        # Merge with HU Priority Group info
                        if not df_prio_grp.empty:
                            df_hu_merged['EXIDV_STR'] = df_hu_merged['EXIDV'].astype(str).str.strip().str.zfill(20)
                            df_hu_merged = pd.merge(df_hu_merged, df_prio_grp, left_on='EXIDV_STR', right_on='EXIDV', how='left', suffixes=('', '_prio'))
                            df_hu_merged['GROUPED'] = df_hu_merged['ZEXIDVGRP'].notnull().map({True: 'OK', False: 'NOT OK'})
                            if 'EXIDV_prio' in df_hu_merged.columns:
                                df_hu_merged = df_hu_merged.drop(columns=['EXIDV_prio', 'EXIDV_STR'])
                        else:
                            df_hu_merged['GROUPED'] = 'NOT OK'
                            df_hu_merged['ZEXIDVGRP'] = None
                            df_hu_merged['PICKINIUSER'] = None
                        
                        # Add FLOOR mapping for HUs
                        df_hu_merged['FLOOR'] = df_hu_merged['VLTYP'].map(lambda x: FLOOR_MAPPING.get(str(x), 'unknown_floor'))
                        
                        # Calculate picking status per EXIDV (individual box) via TANUM.
                        # ZORF_HU_TO_LINK.TANUM = LTAP.TANUM links each Transfer Order to its HU.
                        # A box is only marked Picked when ALL of its own LTAP lines have QDATU set.
                        df_ltap_tanum = df_ltap_dash[['TANUM', 'QDATU']].copy()
                        df_ltap_tanum['TANUM'] = df_ltap_tanum['TANUM'].astype(str).str.strip()
                        
                        df_hu_tanum = df_hu_dash[['EXIDV', 'TANUM', 'VBELN']].copy()
                        df_hu_tanum = df_hu_tanum[df_hu_tanum['VBELN'].isin(df_likp_dept['VBELN'])]
                        
                        # Join LTAP lines → HUs via TANUM
                        df_ltap_hu_join = pd.merge(df_ltap_tanum, df_hu_tanum[['EXIDV', 'TANUM']], on='TANUM', how='inner')
                        
                        if not df_ltap_hu_join.empty:
                            exidv_pick_status = df_ltap_hu_join.groupby('EXIDV')['QDATU'].apply(lambda x: x.notnull().all()).to_dict()
                        else:
                            exidv_pick_status = {}
                        
                        df_hu_merged['IS_PICKED'] = df_hu_merged['EXIDV'].map(exidv_pick_status).fillna(False)

                        # priority count from LTAP (Lines instead of Deliveries)
                        # Normalize LPRIO for consistent grouping
                        df_ltap_merged['LPRIO_NORM'] = df_ltap_merged['LPRIO'].astype(str).str.lstrip('0')
                        p_line_counts = df_ltap_merged['LPRIO_NORM'].value_counts().sort_index().to_dict()
                        
                        # Enhanced Cutoff metrics
                        cutoff_groups = df_likp_dept.groupby('WAUHR')
                        cutoff_details = {}
                        for wauhr, group in cutoff_groups:
                            ltap_group = df_ltap_merged[df_ltap_merged['WAUHR'] == wauhr]
                            hu_group = df_hu_merged[df_hu_merged['WAUHR'] == wauhr] if not df_hu_merged.empty else pd.DataFrame()
                            
                            # Use normalized LPRIO for inner metrics as well
                            ltap_group['LPRIO_NORM'] = ltap_group['LPRIO'].astype(str).str.lstrip('0')
                            group['LPRIO_NORM'] = group['LPRIO'].astype(str).str.lstrip('0')
                            
                            cutoff_details[str(wauhr)] = {
                                "total_deliveries": int(len(group)),
                                "dp10_deliveries": int(len(group[group['LPRIO_NORM'] == '10'])),
                                "total_lines": int(len(ltap_group)),
                                "picked_lines": int(len(ltap_group[ltap_group['QDATU'].notnull()])),
                                "dp10_lines": int(len(ltap_group[ltap_group['LPRIO_NORM'] == '10'])),
                                "total_hus": int(len(hu_group)),
                                "picked_hus": int(len(hu_group[hu_group['IS_PICKED'] == True])) if not hu_group.empty else 0
                            }
                        
                        # HU Summary Stats
                        total_hus = len(df_hu_merged)
                        picked_hus = len(df_hu_merged[df_hu_merged['IS_PICKED'] == True])
                        total_lines = len(df_ltap_dept)
                        total_items = df_ltap_dept['NISTA'].sum()
                        
                        dashboard_json = {
                            "open_deliveries": len(df_likp_dept),
                            "open_hus": total_hus,
                            "hu_summary": {
                                "total": total_hus,
                                "picked": picked_hus,
                                "not_picked": total_hus - picked_hus,
                                "avg_lines_per_hu": round(total_lines / total_hus, 2) if total_hus > 0 else 0,
                                "avg_items_per_hu": round(total_items / total_hus, 2) if total_hus > 0 else 0
                            },
                            "priorities": {str(k): int(v) for k, v in p_line_counts.items()},
                            "priority_hus": df_hu_merged['LPRIO'].astype(str).str.lstrip('0').value_counts().sort_index().to_dict() if not df_hu_merged.empty else {},
                            "cutoffs": cutoff_details,
                            "summary": get_metrics_local(df_ltap_dept),
                            "vltyp_distribution": {},
                            "kober_distribution": {}
                        }
                        
                        for v_type in df_ltap_dept['VLTYP'].unique():
                            dashboard_json["vltyp_distribution"][str(v_type)] = get_metrics_local(df_ltap_dept[df_ltap_dept['VLTYP'] == v_type])
                        for k_val in df_ltap_dept['KOBER'].unique():
                            dashboard_json["kober_distribution"][str(k_val)] = get_metrics_local(df_ltap_dept[df_ltap_dept['KOBER'] == k_val])
                        
                        # Add Closed Today metrics (only for Today scenario)
                        if scenario['name'] == 'today':
                            df_c_dept = df_closed_all[df_closed_all['LGNUM'] == lgnum]
                            df_ltap_c_dept = df_ltap_closed_all[df_ltap_closed_all['LGNUM'] == lgnum]
                            df_hu_c_dept = df_hu_closed_all[df_hu_closed_all['VBELN'].isin(df_c_dept['VBELN'])]
                            
                            # Additional filters for closed LTAP (Consistency with open lines)
                            if lgnum == '266':
                                df_ltap_c_dept = df_ltap_c_dept[df_ltap_c_dept.apply(filter_cvns_local, axis=1)]
                            else:
                                df_ltap_c_dept = df_ltap_c_dept[df_ltap_c_dept.apply(filter_ms_local, axis=1)]

                            dashboard_json["closed_today"] = {
                                "deliveries": int(len(df_c_dept)),
                                "hus": int(len(df_hu_c_dept)),
                                "lines": int(len(df_ltap_c_dept)),
                                "items": int(df_ltap_c_dept['NISTA'].sum()),
                                "requested_items": int(df_ltap_c_dept['VSOLA'].sum()),
                                "vol": round(float(df_ltap_c_dept['VOLUM'].sum() / 1000000), 3), # in M3
                                "kg": round(float(df_ltap_c_dept['BRGEW'].sum()), 2)
                            }

                        if lgnum == '266':
                            dashboard_json["floors"] = {}
                            df_ltap_merged['FLOOR'] = df_ltap_merged['VLTYP'].map(lambda x: FLOOR_MAPPING.get(str(x), 'unknown_floor'))
                            for floor in df_ltap_merged['FLOOR'].unique():
                                if floor != 'unknown_floor':
                                    floor_df = df_ltap_merged[df_ltap_merged['FLOOR'] == floor]
                                    floor_metrics = get_metrics_local(floor_df)
                                    
                                    # Normalize LPRIO for comparison (handling potential leading zeros)
                                    floor_df['LPRIO_NORM'] = floor_df['LPRIO'].astype(str).str.lstrip('0')
                                    
                                    # Add extra metrics requested for Floor Operations
                                    floor_metrics["total"]["deliveries"] = int(floor_df['VBELN'].nunique())
                                    floor_metrics["total"]["dp10_deliveries"] = int(floor_df[floor_df['LPRIO_NORM'] == '10']['VBELN'].nunique())
                                    floor_metrics["total"]["dp10_lines"] = int(len(floor_df[floor_df['LPRIO_NORM'] == '10']))
                                    
                                    # HU metrics for floor
                                    floor_vbelns = floor_df['VBELN'].unique()
                                    floor_hu = df_hu_merged[df_hu_merged['VBELN'].isin(floor_vbelns)]
                                    floor_metrics["hu_summary"] = {
                                        "total": int(len(floor_hu)),
                                        "picked": int(len(floor_hu[floor_hu['IS_PICKED'] == True])),
                                        "not_picked": int(len(floor_hu[floor_hu['IS_PICKED'] == False]))
                                    }
                                    dashboard_json["floors"][floor] = floor_metrics

                        with open(os.path.join(output_dir, filename), 'w') as f:
                            json.dump(dashboard_json, f, indent=4)
                        print(f"Generated {filename}")

                        # --- DETAILED LINES EXPORT ---
                        lines_filename = filename.replace('dashboard_data_', 'dashboard_lines_')
                        export_cols = ['VBELN', 'LPRIO', 'WAUHR', 'VLPLA', 'VLTYP', 'KOBER', 'NISTA', 'BRGEW', 'VOLUM', 'QDATU', 'VSOLA']
                        if 'FLOOR' in df_ltap_merged.columns:
                            export_cols.append('FLOOR')
                        
                        # Filter to columns that exist
                        existing_cols = [c for c in export_cols if c in df_ltap_merged.columns]
                        df_lines_export = df_ltap_merged[existing_cols].copy()
                        
                        # Ensure string types for joining/export
                        df_lines_export['VBELN'] = df_lines_export['VBELN'].astype(str).str.strip().str.lstrip('0')
                        df_lines_export['LPRIO'] = df_lines_export['LPRIO'].astype(str)
                        df_lines_export['WAUHR'] = df_lines_export['WAUHR'].astype(str)
                        
                        # Save specifically for the detailed view modal
                        df_lines_export.to_json(os.path.join(output_dir, lines_filename), orient='records', indent=4)
                        print(f"Generated {lines_filename}")

                        # --- DETAILED HU EXPORT ---
                        hu_export_filename = filename.replace('dashboard_data_', 'dashboard_hu_')
                        # Calculate per-delivery stats to assign proportionally to HUs
                        deliv_stats = df_ltap_dept.groupby('VBELN').agg({
                            'NISTA': 'sum',
                            'VSOLA': 'sum',
                            'VBELN': 'count' # Line count
                        }).rename(columns={'VBELN': 'LINES_COUNT', 'VSOLA': 'ITEMS_COUNT'}).reset_index()
                        
                        # Get HU count per delivery
                        hu_counts = df_hu_merged.groupby('VBELN').size().reset_index(name='HU_PER_DELIV')
                        
                        # Merge stats
                        hu_stats_merged = pd.merge(df_hu_merged, deliv_stats, on='VBELN', how='left')
                        hu_stats_merged = pd.merge(hu_stats_merged, hu_counts, on='VBELN', how='left')
                        
                        # Calculate proportional counts
                        hu_stats_merged['LINES_PER_HU'] = (hu_stats_merged['LINES_COUNT'] / hu_stats_merged['HU_PER_DELIV']).round(2)
                        hu_stats_merged['ITEMS_PER_HU'] = (hu_stats_merged['ITEMS_COUNT'] / hu_stats_merged['HU_PER_DELIV']).round(2)
                        
                        # Prepare export columns
                        hu_export_cols = ['EXIDV', 'VBELN', 'LPRIO', 'WAUHR', 'IS_PICKED', 'LINES_PER_HU', 'ITEMS_PER_HU', 'FLOOR', 'GROUPED', 'ZEXIDVGRP', 'PICKINIUSER']
                        # Ensure all columns exist 
                        for col in hu_export_cols:
                            if col not in hu_stats_merged.columns:
                                hu_stats_merged[col] = None
                                
                        df_hu_export = hu_stats_merged[hu_export_cols].copy()
                        df_hu_export['LPRIO'] = df_hu_export['LPRIO'].astype(str)
                        df_hu_export['WAUHR'] = df_hu_export['WAUHR'].astype(str)
                        df_hu_export['FLOOR'] = df_hu_export['FLOOR'].astype(str)
                        
                        df_hu_export.to_json(os.path.join(output_dir, hu_export_filename), orient='records', indent=4)
                        print(f"Generated {hu_export_filename}")
                else:
                    print(f"No B-FLOW {scenario['name']} deliveries found.")
            except Exception as ex:
                print(f"B-FLOW {scenario['name']} Extraction Error: {ex}")
    else:
        print("No B-flow routes found in routes.csv. Skipping dashboard JSON generation.")


    # --- PICKING EXTRACTION ---
    columns = ['MATNR', 'CHARG', 'NISTA', 'QDATU', 'QZEIT', 'QNAME', 'BRGEW', 'GEWEI', 'VLTYP', 'VLPLA', 'NLPLA', 'VBELN', 'LGNUM', 'VSOLA']
    cols_str = ", ".join(columns)

    print(f"Fetching base picking data from SDS_CP_LTAP for {target_date}...")
    
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
        print(f"No picking data found in SDS_CP_LTAP for date {target_date}.")
        df_ltap_filtered = pd.DataFrame(columns=columns)
    else:
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
        print("No valid picking rows remains after VLPLA filtering. Skipping picking stats.")
        df_routes_db = pd.DataFrame(columns=['VBELN', 'ROUTE'])
    else:
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

    # --- PACKING EXTRACTION ---
    target_dt_obj = datetime.strptime(target_date, '%Y-%m-%d')
    start_dt_obj = target_dt_obj - pd.Timedelta(days=5)
    
    target_date_compact = target_date.replace('-', '') # E.g. 20260224
    start_date_compact = start_dt_obj.strftime('%Y%m%d') # E.g. 20260219

    print(f"Fetching packing data with 5-day lookback: {start_date_compact} to {target_date_compact}...")

    # Join SDS_CP_CDHDR, SDS_CP_VEKP, and HU (link/his)
    packing_query = f"""
    WITH PACK_HEADERS AS (
        SELECT OBJECTID, USERNAME, UDATE, UTIME
        FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_CDHDR
        WHERE UDATE >= '{start_date_compact}'
          AND UDATE <= '{target_date_compact}'
          AND OBJECTCLAS = 'HANDL_UNIT'
          AND (TCODE = 'ZORF_BOX_CLOSING' OR USERNAME = 'WEBMREMOTEWS')
    ),
    PACK_EXIDV AS (
        SELECT DISTINCT VENUM, EXIDV
        FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_VEKP
        WHERE VENUM IN (SELECT OBJECTID FROM PACK_HEADERS)
    ),
    HU_INFO AS (
        SELECT EXIDV, LGNUM, VLTYP, ROUTE FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HU_TO_LINK
        UNION
        SELECT EXIDV, LGNUM, VLTYP, ROUTE FROM PROD_CDH_DB.SDS_MAIN.SDS_CP_ZORF_HUTO_LNKHIS
    )
    SELECT 
        H.OBJECTID, H.USERNAME, H.UDATE, H.UTIME, 
        I.LGNUM, I.VLTYP, I.ROUTE
    FROM PACK_HEADERS H
    JOIN PACK_EXIDV E ON H.OBJECTID = E.VENUM
    JOIN HU_INFO I ON E.EXIDV = I.EXIDV
    WHERE I.LGNUM IN ('245', '266')
      AND (H.USERNAME != 'WEBMREMOTEWS' OR I.LGNUM = '245')
    """
    
    try:
        cur.execute(packing_query)
        rows_packing = cur.fetchall()
        df_packing_raw = pd.DataFrame(rows_packing, columns=['OBJECTID', 'USERNAME', 'UDATE', 'UTIME', 'LGNUM', 'VLTYP', 'ROUTE'])
        print(f"Found {len(df_packing_raw)} raw packing rows in history window.")
        
        if not df_packing_raw.empty:
            # 1. Ensure UTIME is padded (6 chars) so sorting is chronological
            df_packing_raw['UTIME'] = df_packing_raw['UTIME'].astype(str).str.zfill(6)
            
            # 2. Sort by Date and Time
            df_packing_raw = df_packing_raw.sort_values(['UDATE', 'UTIME'], ascending=True)
            
            # 3. For each OBJECTID, only keep the FIRST (earliest) record
            df_packing_unique = df_packing_raw.drop_duplicates(subset=['OBJECTID'], keep='first')
            
            # 4. Attribution: Only count for today if the EARLIEST hit was actually TODAY
            df_packing = df_packing_unique[df_packing_unique['UDATE'] == target_date_compact].copy()
            print(f"Attributed {len(df_packing)} boxes to today's activity.")
        else:
            df_packing = pd.DataFrame(columns=['OBJECTID', 'USERNAME', 'UDATE', 'UTIME', 'LGNUM', 'VLTYP', 'ROUTE'])

    except Exception as e:
        print(f"Packing Query Error: {e}")
        df_packing = pd.DataFrame(columns=['OBJECTID', 'USERNAME', 'UDATE', 'UTIME', 'LGNUM', 'VLTYP', 'ROUTE'])

    cur.close()
    conn.close()

    print("Transforming data...")

    # --- PICKING TRANSFORMATION ---
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
                time_part = val_str.split()[-1]
                return int(time_part.split(':')[0])
                
            if '.' in val_str:
                val_str = val_str.split('.')[0]
                
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
    df_merged['NISTA'] = pd.to_numeric(df_merged['NISTA'], errors='coerce').fillna(0)
    df_merged['VSOLA'] = pd.to_numeric(df_merged['VSOLA'], errors='coerce').fillna(0)

    # Filter out unknown_floor from picking
    df_merged = df_merged[df_merged['FLOOR'] != 'unknown_floor'].copy()

    # --- PACKING TRANSFORMATION ---
    if not df_packing.empty:
        df_packing['FLOW'] = df_packing['ROUTE'].apply(map_flow)
        def adjust_hour(row):
            h = extract_hour(row['UTIME'])
            if h != -1 and row['USERNAME'] != 'WEBMREMOTEWS':
                return (h + 1) % 24
            return h

        df_packing['HOUR'] = df_packing.apply(adjust_hour, axis=1)
        
        def map_floor_packing(row):
            if row['LGNUM'] == '245': return 'ground_floor'
            vltyp = str(row['VLTYP']) if row['VLTYP'] else ""
            return FLOOR_MAPPING.get(vltyp, 'unknown_floor')
            
        df_packing['FLOOR'] = df_packing.apply(map_floor_packing, axis=1)
        # Filter out unknown_floor from packing
        df_packing = df_packing[df_packing['FLOOR'] != 'unknown_floor'].copy()
        
        # For packing, QNAME mapping
        df_packing = df_packing.rename(columns={'USERNAME': 'QNAME', 'UDATE': 'QDATU'})
    
    print("Calculating statistics...")

    def calculate_picking_stats(df):
        if df.empty: return pd.DataFrame(), pd.DataFrame()
        
        # Ensure numeric
        df['BRGEW'] = pd.to_numeric(df['BRGEW'], errors='coerce').fillna(0)
        df['NISTA'] = pd.to_numeric(df['NISTA'], errors='coerce').fillna(0)
        df['VSOLA'] = pd.to_numeric(df['VSOLA'], errors='coerce').fillna(0)

        # 1. First, calculate context-wide benchmarks (Flow & Floor specific)
        context_benchmarks = {}
        for (flow, floor), context_df in df.groupby(['FLOW', 'FLOOR']):
            if not context_df.empty:
                total_lines = len(context_df)
                total_weight = context_df['BRGEW'].sum()
                total_items = context_df['NISTA'].sum()
                context_benchmarks[(flow, floor)] = {
                    'avg_wpl': total_weight / total_lines if total_lines > 0 else 0,
                    'avg_ipl': total_items / total_lines if total_lines > 0 else 0
                }

        # 2. Identify how many work contexts (Flow/Floor) each user worked in per hour
        context_counts = df.groupby(['QNAME', 'QDATU', 'HOUR']).apply(
            lambda x: x.groupby(['FLOW', 'FLOOR']).ngroups
        ).to_dict()

        hourly_groups = df.groupby(['QNAME', 'QDATU', 'HOUR', 'FLOW', 'FLOOR'])
        rows = []
        for name, group in hourly_groups:
            qname, qdatu, hour, flow, floor = name
            lines = len(group)
            items = group['NISTA'].sum()
            weight = group['BRGEW'].sum()
            
            # Distribute effort
            base_effort = BREAK_MAPPING.get(hour, 1.0)
            n_contexts = context_counts.get((qname, qdatu, hour), 1)
            distributed_effort = base_effort / n_contexts
            
            # Calculate Intensity for this specific hour in this flow/floor
            bench = context_benchmarks.get((flow, floor), {'avg_wpl': 1, 'avg_ipl': 1})
            wpl = weight / lines if lines > 0 else 0
            ipl = items / lines if lines > 0 else 0
            
            weight_intensity = round(wpl / bench['avg_wpl'], 2) if bench['avg_wpl'] > 0 else 1.0
            item_intensity = round(ipl / bench['avg_ipl'], 2) if bench['avg_ipl'] > 0 else 1.0
            
            rows.append({
                'QNAME': qname, 'QDATU': qdatu, 'HOUR': hour, 'FLOW': flow, 'FLOOR': floor,
                'LINES_PICKED': lines, 'ITEMS_PICKED': items, 'WEIGHT_PICKED': round(weight, 2),
                'RATIO': round(items/lines, 2) if lines > 0 else 0,
                'EFFORT': round(distributed_effort, 2), 
                'PRODUCTIVITY': round(lines/distributed_effort, 2) if distributed_effort > 0 else 0,
                'WEIGHT_INTENSITY': weight_intensity,
                'ITEM_INTENSITY': item_intensity
            })
            
        df_h = pd.DataFrame(rows)
        
        # 3. Aggregate to Daily
        df_d = df_h.groupby(['QNAME', 'QDATU', 'FLOW', 'FLOOR']).agg({
            'LINES_PICKED': 'sum', 
            'ITEMS_PICKED': 'sum', 
            'WEIGHT_PICKED': 'sum',
            'EFFORT': 'sum'
        }).reset_index()
        
        df_d['EFFORT'] = df_d['EFFORT'].round(2)
        df_d['WEIGHT_PICKED'] = df_d['WEIGHT_PICKED'].round(2)
        df_d['RATIO'] = (df_d['ITEMS_PICKED'] / df_d['LINES_PICKED']).round(2)
        df_d['PRODUCTIVITY'] = (df_d['LINES_PICKED'] / df_d['EFFORT']).round(2)
        
        # Calculate daily weighted intensities
        def calc_daily_intensity(row):
            bench = context_benchmarks.get((row['FLOW'], row['FLOOR']), {'avg_wpl': 1, 'avg_ipl': 1})
            wpl = row['WEIGHT_PICKED'] / row['LINES_PICKED'] if row['LINES_PICKED'] > 0 else 0
            ipl = row['ITEMS_PICKED'] / row['LINES_PICKED'] if row['LINES_PICKED'] > 0 else 0
            
            wi = round(wpl / bench['avg_wpl'], 2) if bench['avg_wpl'] > 0 else 1.0
            ii = round(ipl / bench['avg_ipl'], 2) if bench['avg_ipl'] > 0 else 1.0
            return pd.Series([wi, ii])

        df_d[['WEIGHT_INTENSITY', 'ITEM_INTENSITY']] = df_d.apply(calc_daily_intensity, axis=1)
        
        return df_h, df_d

    def calculate_packing_stats(df):
        if df.empty: return pd.DataFrame(), pd.DataFrame()
        
        # 1. Identify context counts for packing
        context_counts = df.groupby(['QNAME', 'QDATU', 'HOUR']).apply(
            lambda x: x.groupby(['FLOW', 'FLOOR']).ngroups
        ).to_dict()

        hourly_groups = df.groupby(['QNAME', 'QDATU', 'HOUR', 'FLOW', 'FLOOR'])
        rows = []
        for name, group in hourly_groups:
            qname, qdatu, hour, flow, floor = name
            # Use nunique to count distinct boxes as requested
            boxes = group['OBJECTID'].nunique()
            
            # 2. Distribute effort
            base_effort = BREAK_MAPPING.get(hour, 1.0)
            n_contexts = context_counts.get((qname, qdatu, hour), 1)
            distributed_effort = base_effort / n_contexts
            
            rows.append({
                'QNAME': qname, 'QDATU': qdatu, 'HOUR': hour, 'FLOW': flow, 'FLOOR': floor,
                'BOXES_PACKED': boxes, 'EFFORT': round(distributed_effort, 2), 
                'PRODUCTIVITY': round(boxes/distributed_effort, 2) if distributed_effort > 0 else 0
            })
        df_h = pd.DataFrame(rows)
        df_d = df_h.groupby(['QNAME', 'QDATU', 'FLOW', 'FLOOR']).agg({
            'BOXES_PACKED': 'sum', 'EFFORT': 'sum'
        }).reset_index()
        df_d['EFFORT'] = df_d['EFFORT'].round(2)
        df_d['PRODUCTIVITY'] = (df_d['BOXES_PACKED'] / df_d['EFFORT']).round(2)
        return df_h, df_d

    # Calculating
    ms_picking_h, ms_picking_d = calculate_picking_stats(df_merged[df_merged['LGNUM'] == '245'])
    cvns_picking_h, cvns_picking_d = calculate_picking_stats(df_merged[df_merged['LGNUM'] == '266'])
    
    ms_packing_h, ms_packing_d = calculate_packing_stats(df_packing[df_packing['LGNUM'] == '245'])
    cvns_packing_h, cvns_packing_d = calculate_packing_stats(df_packing[df_packing['LGNUM'] == '266'])

    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
    os.makedirs(output_dir, exist_ok=True)

    output_mapping = {
        'ms_picking_hourly_stats.csv': ms_picking_h,
        'ms_picking_daily_stats.csv': ms_picking_d,
        'cvns_picking_hourly_stats.csv': cvns_picking_h,
        'cvns_picking_daily_stats.csv': cvns_picking_d,
        'ms_packing_hourly_stats.csv': ms_packing_h,
        'ms_packing_daily_stats.csv': ms_packing_d,
        'cvns_packing_hourly_stats.csv': cvns_packing_h,
        'cvns_packing_daily_stats.csv': cvns_packing_d
    }

    for filename, df in output_mapping.items():
        if not df.empty:
            df.to_csv(os.path.join(output_dir, filename), index=False)
            print(f"Generated {filename}")
        
    print("Done!")

if __name__ == "__main__":
    main()
