import geopandas as gpd
import pytest
from shapely.geometry import box

from tabush.risk.tenure_overlaps import OVERLAP_COLUMNS, confidence, flag_properties

# Small boxes near Canguçu; 0.01° is about 1 km, so each box is about 100 ha.
D = 0.01


def car(rows):
    ids, types, statuses, geoms = zip(*rows, strict=True)
    return gpd.GeoDataFrame(
        {
            "source_id": ids,
            "property_type": types,
            "status": statuses,
            "source": "SICAR (CAR)",
            "snapshot_date": "2026-11-25",
        },
        geometry=list(geoms),
        crs=4674,
    )


def territory(name, geom, **extra):
    return gpd.GeoDataFrame(
        {"source_id": [name], "name": [name], "source": "test", "snapshot_date": "2026-11-01"}
        | {k: [v] for k, v in extra.items()},
        geometry=[geom],
        crs=4674,
    )


def at(x, y, w=D, h=D):
    return box(-52.5 + x, -31.3 + y, -52.5 + x + w, -31.3 + y + h)


def test_neighbours_sharing_a_fence_are_not_flagged():
    gdf = car([("A", "IRU", "AT", at(0, 0)), ("B", "IRU", "AT", at(0.0098, 0))])  # 2% overlap
    flagged, _ = flag_properties(gdf)
    assert flagged["tenure_flag"].tolist() == ["none", "none"]
    assert flagged["car_overlap_pct"].iloc[0] == pytest.approx(2, abs=0.2)


def test_duplicate_claim_is_flagged_with_a_traceable_row():
    gdf = car([("A", "IRU", "AT", at(0, 0)), ("B", "IRU", "AT", at(0.005, 0))])  # 50% overlap
    flagged, overlaps = flag_properties(gdf)
    assert flagged["tenure_flag"].tolist() == ["car_overlap", "car_overlap"]
    assert flagged["car_overlap_count"].tolist() == [1, 1]
    assert list(overlaps.columns) == OVERLAP_COLUMNS
    row = overlaps[overlaps["subject_id"] == "A"].iloc[0]
    assert (row["object_layer"], row["object_id"]) == ("car", "B")
    assert row["overlap_pct"] == pytest.approx(50, abs=0.5)
    assert row["confidence"] == "high"
    assert (row["source"], row["snapshot_date"]) == ("SICAR (CAR)", "2026-11-25")


def test_share_counts_overlapping_neighbours_once():
    # B and C both cover the same eastern half of A.
    gdf = car(
        [
            ("A", "IRU", "AT", at(0, 0)),
            ("B", "IRU", "AT", at(0.005, 0)),
            ("C", "IRU", "AT", at(0.005, 0)),
        ]
    )
    flagged, _ = flag_properties(gdf)
    assert flagged.set_index("source_id").loc["A", "car_overlap_pct"] == pytest.approx(50, abs=0.5)


def test_settlements_traditional_and_cancelled_records_are_not_assessed():
    gdf = car(
        [
            ("SETTLEMENT", "AST", "AT", at(0, 0, 4 * D, 4 * D)),
            ("LOT", "IRU", "AT", at(D, D)),
            ("COMMUNITY", "PCT", "AT", at(D, D)),
            ("OLD", "IRU", "CA", at(D, D)),
        ]
    )
    flagged, _ = flag_properties(gdf)
    flags = flagged.set_index("source_id")["tenure_flag"].to_dict()
    # The lot sits inside its settlement, beside a traditional community: both expected.
    assert flags == {
        "SETTLEMENT": "not_assessed",
        "LOT": "none",
        "COMMUNITY": "not_assessed",
        "OLD": "not_assessed",
    }


def test_public_land_outranks_car_overlap():
    gdf = car([("A", "IRU", "AT", at(0, 0)), ("B", "IRU", "AT", at(0.005, 0))])
    territories = {
        "indigenous_lands": territory("TI", at(0.008, 0, D, D)),  # 20% of A, 70% of B
        "protected_areas": territory("PARK", at(-0.002, 0, 0.004, D), public_domain=True),
    }
    flagged, overlaps = flag_properties(gdf, territories)
    assert flagged.set_index("source_id")["tenure_flag"].to_dict() == {
        "A": "indigenous_land",
        "B": "indigenous_land",
    }
    assert set(overlaps["object_layer"]) == {"car", "indigenous_lands", "protected_areas"}
    ti_rows = overlaps[overlaps["object_layer"] == "indigenous_lands"]
    assert ti_rows["object_source"].eq("test").all()


def test_protected_areas_that_allow_private_land_are_ignored():
    gdf = car([("A", "IRU", "AT", at(0, 0))])
    apa = territory("APA", at(-D, -D, 3 * D, 3 * D), public_domain=False)
    flagged, overlaps = flag_properties(gdf, {"protected_areas": apa})
    assert flagged["tenure_flag"].tolist() == ["none"]
    assert overlaps.empty


def test_confidence_bands():
    import pandas as pd

    assert confidence(pd.Series([3.0, 25.0, 80.0])).tolist() == ["low", "medium", "high"]
