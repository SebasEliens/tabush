import json

from tabush.ingest.municipalities import parse_population

# Shape of IBGE's aggregates API answer for table 9718 (trimmed), as saved by download().
PAYLOAD = json.loads("""[
 {"id": "93", "resultados": [
   {"classificacoes": [{"id": "1714", "categoria": {"60024": "Total"}},
                       {"id": "2661", "categoria": {"32776": "Total"}}],
    "series": [{"localidade": {"id": "4304507"}, "serie": {"2022": "49680"}},
               {"localidade": {"id": "1507300"}, "serie": {"2022": "65418"}}]},
   {"classificacoes": [{"id": "1714", "categoria": {"60024": "Total"}},
                       {"id": "2661", "categoria": {"12869": "Em terras indígenas"}}],
    "series": [{"localidade": {"id": "4304507"}, "serie": {"2022": "-"}},
               {"localidade": {"id": "1507300"}, "serie": {"2022": "2300"}}]}]},
 {"id": "350", "resultados": [
   {"classificacoes": [{"id": "1714", "categoria": {"60024": "Total"}},
                       {"id": "2661", "categoria": {"32776": "Total"}}],
    "series": [{"localidade": {"id": "4304507"}, "serie": {"2022": "33"}},
               {"localidade": {"id": "1507300"}, "serie": {"2022": "2451"}}]},
   {"classificacoes": [{"id": "1714", "categoria": {"60024": "Total"}},
                       {"id": "2661", "categoria": {"12869": "Em terras indígenas"}}],
    "series": [{"localidade": {"id": "4304507"}, "serie": {"2022": "-"}},
               {"localidade": {"id": "1507300"}, "serie": {"2022": "X"}}]}]}
]""")


def test_population_takes_totals_and_indigenous_people_in_indigenous_lands():
    df = parse_population(PAYLOAD).set_index("source_id")
    assert df.loc["4304507"].to_dict() == {
        "population": 49680,
        "indigenous_population": 33,
        "indigenous_population_in_ti": 0,  # SIDRA writes "-" for zero
    }
    assert df.loc["1507300", "population"] == 65418  # residents in TIs are not the total
    assert df.loc["1507300", "indigenous_population"] == 2451
    assert df["indigenous_population_in_ti"].isna().sum() == 1  # "X" = withheld
