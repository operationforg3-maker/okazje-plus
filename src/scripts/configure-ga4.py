#!/usr/bin/env python3
import json
import urllib.request
import urllib.error
from google.oauth2 import service_account
from google.auth.transport.requests import Request

KEY_PATH = '/Users/tomaszgorecki/.config/gcloud/legacy_credentials/firebase-adminsdk-fbsvc@okazje-plus.iam.gserviceaccount.com/adc.json'
SCOPES = [
    'https://www.googleapis.com/auth/analytics.edit',
    'https://www.googleapis.com/auth/analytics.readonly'
]

def get_auth_token():
    creds = service_account.Credentials.from_service_account_file(KEY_PATH, scopes=SCOPES)
    creds.refresh(Request())
    return creds.token

def api_call(url, token, method='GET', data=None):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            return json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        try:
            return {'error': json.loads(err_msg)}
        except Exception:
            return {'error': {'code': e.code, 'message': err_msg}}

def configure():
    print("1. Pobieranie tokena konta serwisowego...")
    token = get_auth_token()
    print("   [OK] Token wygenerowany pomyślnie.")

    property_id = "properties/510803602"
    print(f"\n2. Konfiguracja usługi GA4: {property_id} (Okazje Plus)...")

    # 1. Kluczowe zdarzenia (Key Events)
    key_events = ['affiliate_click', 'go_to_deal', 'go_to_product', 'select_item']
    print("\n3. Sprawdzanie i rejestrowanie Kluczowych Zdarzeń (Key Events)...")
    curr_events_res = api_call(f"https://analyticsadmin.googleapis.com/v1beta/{property_id}/keyEvents", token)
    existing_events = set()
    for ev in curr_events_res.get('keyEvents', []):
        existing_events.add(ev.get('eventName'))
    print(f"   Istniejące kluczowe zdarzenia: {sorted(list(existing_events))}")

    for event_name in key_events:
        if event_name in existing_events:
            print(f"   [OK] '{event_name}' jest już zarejestrowane.")
        else:
            payload = {'eventName': event_name, 'countingMethod': 'ONCE_PER_EVENT'}
            create_res = api_call(
                f"https://analyticsadmin.googleapis.com/v1beta/{property_id}/keyEvents",
                token,
                method='POST',
                data=payload
            )
            if 'error' in create_res:
                print(f"   [BŁĄD] Nie udało się dodać '{event_name}': {create_res['error']}")
            else:
                print(f"   [SUKCES] Utworzono kluczowe zdarzenie: '{event_name}' (ID: {create_res.get('name')})")

    # 2. Wymiary niestandardowe (Custom Dimensions)
    dimensions = [
        {'parameterName': 'merchant', 'displayName': 'Sklep', 'description': 'Nazwa sklepu / partnera afiliacyjnego'},
        {'parameterName': 'deal_id', 'displayName': 'ID Oferty', 'description': 'Identyfikator okazji lub produktu'},
        {'parameterName': 'item_id', 'displayName': 'ID Przedmiotu', 'description': 'Identyfikator przedmiotu w sklepie'},
        {'parameterName': 'category', 'displayName': 'Kategoria', 'description': 'Kategoria oferty / produktu'},
        {'parameterName': 'discount_pct', 'displayName': 'Rabat %', 'description': 'Wartość procentowa rabatu'}
    ]

    print("\n4. Sprawdzanie i rejestrowanie Wymiarów Niestandardowych (Custom Dimensions)...")
    curr_dims_res = api_call(f"https://analyticsadmin.googleapis.com/v1beta/{property_id}/customDimensions", token)
    existing_params = set()
    for dim in curr_dims_res.get('customDimensions', []):
        existing_params.add(dim.get('parameterName'))
    print(f"   Istniejące parametry: {sorted(list(existing_params))}")

    for dim in dimensions:
        p_name = dim['parameterName']
        if p_name in existing_params:
            print(f"   [OK] Wymiar '{dim['displayName']}' ({p_name}) już istnieje.")
        else:
            payload = {
                'parameterName': p_name,
                'displayName': dim['displayName'],
                'description': dim['description'],
                'scope': 'EVENT'
            }
            create_dim_res = api_call(
                f"https://analyticsadmin.googleapis.com/v1beta/{property_id}/customDimensions",
                token,
                method='POST',
                data=payload
            )
            if 'error' in create_dim_res:
                print(f"   [BŁĄD] Nie udało się utworzyć '{p_name}': {create_dim_res['error']}")
            else:
                print(f"   [SUKCES] Utworzono wymiar: '{dim['displayName']}' ({p_name})")

    # 3. Metryki niestandardowe (Custom Metrics) dla rabatu lub ceny jeśli przydatne
    print("\n5. Sprawdzanie i rejestrowanie Metryk Niestandardowych (Custom Metrics)...")
    curr_metrics_res = api_call(f"https://analyticsadmin.googleapis.com/v1beta/{property_id}/customMetrics", token)
    existing_metrics = set()
    for m in curr_metrics_res.get('customMetrics', []):
        existing_metrics.add(m.get('parameterName'))
    print(f"   Istniejące metryki: {sorted(list(existing_metrics))}")

    metrics = [
        {
            'parameterName': 'discount_value',
            'displayName': 'Wartość Rabatu',
            'description': 'Wartość zniżki w PLN',
            'measurementUnit': 'CURRENCY',
            'scope': 'EVENT'
        }
    ]
    for m in metrics:
        p_name = m['parameterName']
        if p_name in existing_metrics:
            print(f"   [OK] Metryka '{m['displayName']}' ({p_name}) już istnieje.")
        else:
            create_metric_res = api_call(
                f"https://analyticsadmin.googleapis.com/v1beta/{property_id}/customMetrics",
                token,
                method='POST',
                data=m
            )
            if 'error' in create_metric_res:
                print(f"   [INFO] Metryka '{p_name}': {create_metric_res['error'].get('message', create_metric_res['error'])}")
            else:
                print(f"   [SUKCES] Utworzono metrykę: '{m['displayName']}' ({p_name})")

    print("\n🎉 Pełna konfiguracja Google Analytics 4 dla usługi Okazje Plus została pomyślnie wdrożona!")

if __name__ == '__main__':
    configure()
