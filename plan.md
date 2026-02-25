1. We need to use snowflake and fetch data from SDS_CP_LIKP with LGNUM 266 and 245 (CVNS and MS), ROUTE with all the routes from route.csv of B-flow, for CVNS VSTEL to be 1NLA, 2NLA, 3NLA, 4NLA and for MS we don't need filter on VSTEL. and WADAT_IST to be today's date.

2. This will give us all the deliveries closed today. So I want to create some data for the dashboard, only for Today scenario, where we calculate how many deliveries we closed, how many handling units, how many lines, how many items, what is the volume, and kg.

3. We might need to use also SDS_CP_LTAP or/and SDS_CP_ZORF_HU_TO_LINK/ZORF_HUTO_LNKHIS to get more informations.