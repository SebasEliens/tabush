"""Land tenure overlap flags for CAR properties.

CAR boundaries are self-declared. When a private rural property (type ``IRU``) is drawn
over another one, over an indigenous land or over a protected area that must be public
land, at least one of the claims is wrong. Studies of land grabbing (*grilagem*) in the
Amazon use exactly these overlaps as evidence (e.g. Imaflora's *Atlas da Agropecuária
Brasileira*; IPAM on undesignated public forests).

Rules, kept deliberately simple so a credit officer can follow them:

- Only private properties (``IRU``) are assessed. Settlement perimeters (``AST``)
  contain their families' lots, and traditional communities (``PCT``) legitimately
  register inside indigenous lands, extractive reserves and sustainable-development
  reserves, so those are expected overlaps, not flags. They get ``not_assessed``.
- Cancelled records (status ``CA``) are ignored.
- A share is the part of the property's own area covered by the union of the other
  polygons, so two neighbours overlapping the same strip don't count twice.
- Shares under ``MIN_SHARE_PCT`` are treated as boundary drawing noise. The bar is
  higher between two CAR records: both are hand-drawn, and in a family-farm municipality
  such as Canguçu half of all properties are under 11 ha, so a few metres of offset
  along a shared fence already cover 5% of a property. A claim on public land matters
  even when it is a small share of the property.
- Protected areas only count when the SNUC law requires public ownership
  (``public_domain``); environmental protection areas and private reserves allow
  private land.

The flag on each property is the most serious finding, in this order: indigenous land,
public protected area, other CAR property, none.

Every overlap is also returned as a row (subject, object, share, source, snapshot date,
confidence), which is what the knowledge graph will load as a relation.
"""

from __future__ import annotations

import geopandas as gpd
import pandas as pd

from tabush.geo import AREA_CRS

MIN_SHARE_PCT = {"car": 20.0, "indigenous_lands": 5.0, "protected_areas": 5.0}

SHARE_COLUMN = {
    "car": "car_overlap_pct",
    "indigenous_lands": "indigenous_overlap_pct",
    "protected_areas": "protected_overlap_pct",
}
FLAG_FOR = {
    "indigenous_lands": "indigenous_land",
    "protected_areas": "public_protected_area",
    "car": "car_overlap",
}

OVERLAP_COLUMNS = [
    "subject_id",
    "object_layer",
    "object_id",
    "object_name",
    "overlap_ha",
    "overlap_pct",
    "confidence",
    "source",
    "snapshot_date",
    "object_source",
    "object_snapshot_date",
]


def confidence(share_pct: pd.Series) -> pd.Series:
    """How sure we are the overlap is a real conflict and not a drawing error.

    Both sides are polygons drawn at different scales, so small shares are often just
    imprecise boundaries. A property mostly inside another claim is hard to explain any
    other way.
    """
    return pd.cut(
        share_pct,
        bins=[-float("inf"), 20, 50, float("inf")],
        labels=["low", "medium", "high"],
        right=False,
    ).astype(str)


def _overlaps(
    subjects: gpd.GeoDataFrame, objects: gpd.GeoDataFrame, layer: str, same_layer: bool
) -> pd.DataFrame:
    """One row per (subject, object) pair whose polygons overlap, with the shared area."""
    left = subjects[["source_id", "geometry"]].to_crs(AREA_CRS).reset_index(drop=True)
    right = objects.to_crs(AREA_CRS).reset_index(drop=True)
    right = right.rename(columns={"source_id": "object_id"})
    right = right.assign(object_name=right["name"] if "name" in right else right["object_id"])
    right = right[["object_id", "object_name", "source", "snapshot_date", "geometry"]]
    pairs = gpd.sjoin(left, right, predicate="intersects", how="inner")
    if same_layer:
        pairs = pairs[pairs["source_id"] != pairs["object_id"]]
    if pairs.empty:
        return pd.DataFrame(columns=["source_id", "piece", "piece_m2", "subject_m2"])
    pairs = pairs.reset_index(drop=True)
    # sjoin keeps the left geometry; fetch the right one by position to intersect.
    subject = pairs.geometry.values
    piece = subject.intersection(right.geometry.values[pairs["index_right"].to_numpy()])
    pairs = pd.DataFrame(pairs.drop(columns=["geometry", "index_right"])).assign(
        piece=piece, piece_m2=piece.area, subject_m2=subject.area, object_layer=layer
    )
    return pairs[pairs["piece_m2"] > 0]


def _shares(subjects: gpd.GeoDataFrame, pairs: pd.DataFrame) -> pd.Series:
    """Percentage of each subject covered by the union of the overlapping pieces."""
    if pairs.empty:
        return pd.Series(0.0, index=subjects["source_id"])
    pieces = gpd.GeoDataFrame(pairs[["source_id"]], geometry=pairs["piece"].values, crs=AREA_CRS)
    covered = pieces.dissolve(by="source_id").area
    own = subjects.set_index("source_id").geometry.to_crs(AREA_CRS).area
    return (100 * covered.reindex(own.index, fill_value=0) / own).clip(upper=100)


def flag_properties(
    car: gpd.GeoDataFrame, territories: dict[str, gpd.GeoDataFrame] | None = None
) -> tuple[gpd.GeoDataFrame, pd.DataFrame]:
    """Add overlap shares and a ``tenure_flag`` to each CAR record.

    ``territories`` maps a layer name (``indigenous_lands``, ``protected_areas``) to its
    normalised GeoDataFrame. Returns the flagged properties and the overlap rows.
    """
    territories = territories or {}
    active = car[car["status"] != "CA"]
    private = active[active["property_type"] == "IRU"]

    objects = {"car": (private, True)}
    if "indigenous_lands" in territories:
        objects["indigenous_lands"] = (territories["indigenous_lands"], False)
    if "protected_areas" in territories:
        pa = territories["protected_areas"]
        objects["protected_areas"] = (pa[pa["public_domain"]], False)

    out = car.copy()
    rows = []
    for layer, (obj, same) in objects.items():
        pairs = _overlaps(private, obj, layer, same)
        share = _shares(private, pairs)
        out[SHARE_COLUMN[layer]] = out["source_id"].map(share).round(1)
        if not pairs.empty:
            pairs["overlap_ha"] = (pairs["piece_m2"] / 10_000).round(2)
            pairs["overlap_pct"] = (100 * pairs["piece_m2"] / pairs["subject_m2"]).round(1)
            # Rows under 1% are boundary slivers; they still count towards the share.
            rows.append(pairs[pairs["overlap_pct"] >= 1.0].drop(columns="piece"))
    for layer in SHARE_COLUMN:
        if SHARE_COLUMN[layer] not in out:
            out[SHARE_COLUMN[layer]] = float("nan")  # layer not ingested, not compared

    out["car_overlap_count"] = 0
    overlaps = _overlap_rows(rows, car)
    if not overlaps.empty:
        counts = (
            overlaps[
                (overlaps["object_layer"] == "car")
                & (overlaps["overlap_pct"] >= MIN_SHARE_PCT["car"])
            ]
            .groupby("subject_id")
            .size()
        )
        out["car_overlap_count"] = out["source_id"].map(counts).fillna(0).astype(int)

    out["tenure_flag"] = "none"
    for layer in ("car", "protected_areas", "indigenous_lands"):  # worst last, so it wins
        hit = out[SHARE_COLUMN[layer]].astype(float).fillna(0) >= MIN_SHARE_PCT[layer]
        out.loc[hit, "tenure_flag"] = FLAG_FOR[layer]
    assessed = (out["property_type"] == "IRU") & (out["status"] != "CA")
    out.loc[~assessed, "tenure_flag"] = "not_assessed"
    return out, overlaps


def _overlap_rows(rows: list[pd.DataFrame], car: gpd.GeoDataFrame) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(columns=OVERLAP_COLUMNS)
    df = pd.concat(rows, ignore_index=True).rename(
        columns={
            "source_id": "subject_id",
            "source": "object_source",
            "snapshot_date": "object_snapshot_date",
        }
    )
    df["source"] = car["source"].iloc[0]
    df["snapshot_date"] = car["snapshot_date"].iloc[0]
    df["confidence"] = confidence(df["overlap_pct"])
    df["object_id"] = df["object_id"].astype(str)
    return df[OVERLAP_COLUMNS].sort_values(["subject_id", "object_layer", "object_id"])
