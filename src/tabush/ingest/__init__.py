"""Download and validate source datasets (CAR, SIGEF, territories, embargoes, MapBiomas).

Each source becomes one module that returns a GeoDataFrame with provenance columns
(`source`, `snapshot_date`, `source_id`).
"""
