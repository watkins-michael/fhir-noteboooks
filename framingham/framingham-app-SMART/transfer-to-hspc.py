import requests,json,sys

def reset_new_bundle():
    return json.loads('''
        {
            "resourceType": "Bundle",
            "id": "c4b905c0-6197-4879-96f9-9a81490281b1",
            "meta": {
                "lastUpdated": "2019-06-20T16:25:17.710+00:00"
            },
            "type": "transaction",
            "total": 1,
            "link": [
                {
                    "relation": "self",
                    "url": "https://api.logicahealth.org/stratfhireducation/open"
                }
            ],
            "entry": []
        }
        ''')

def next_bundle(url):
    next = True
    r = requests.get(url)
    bundle = json.loads(r.text)
    try:
        for link in bundle['link']:
            if link['relation'] == 'self':
                next = False
            if link['relation'] == 'next':
                next = True
                url = link['url']
    except:
        print('server error')
    return next,url,bundle

#SEND PATIENT -
def pat(old_id, new_url):
    url = 'https://api.logicahealth.org/stratfhireducation/open/Patient?_id=' + old_id
    response = requests.get(url)
    bundle = json.loads(response.text)
    r = bundle['entry'][0]['resource']
    new = {'resource': r, 'request': {'method': 'POST', 'url': 'Patient'}}
    pat_b = reset_new_bundle()
    pat_b['entry'].append(new)
    response = requests.post(new_url, json=pat_b)
    r = json.loads(response.text)
    return r['entry'][0]['response']['location'].split('/')[1]

#SEND OBSERVATIONS
def obs(old_id, new_id, new_url):
    next = True
    url = 'https://api.logicahealth.org/stratfhireducation/open/Observation?subject=' + old_id
    obs_b = reset_new_bundle()
    while next == True:
        # Check to see if we will need to handle another bundle after this current one
        next, url, bundle = next_bundle(url)
        # Parse resources in the current bundle
        for r in bundle['entry']:
            r['resource']['subject']['reference'] = 'Patient/' + new_id
            r['resource'].pop('encounter',None)
            new = {'resource': r['resource'], 'request': {'method': 'POST', 'url': 'Observation'}}
            obs_b['entry'].append(new)
    requests.post(new_url, json=obs_b)

#SEND MEDS
def med(old_id, new_id, new_url):
    next = True
    url = 'https://api.logicahealth.org/stratfhireducation/open/MedicationRequest?subject=' + old_id
    med_b = reset_new_bundle()
    while next == True:
        # Check to see if we will need to handle another bundle after this current one
        next, url, bundle = next_bundle(url)
        # Parse resources in the current bundle
        try:
            for r in bundle['entry']:
                r['resource']['subject']['reference'] = 'Patient/' + new_id
                r['resource'].pop('encounter',None)
                r['resource'].pop('reasonReference',None)
                r['resource'].pop('requester',None)
                new = {'resource': r['resource'], 'request': {'method': 'POST', 'url': 'MedicationRequest'}}
                med_b['entry'].append(new)
        except:
            pass
    requests.post(new_url, json=med_b)

#SEND TOTAL CHOLESTEROL
def total_chol(old_id, new_id, new_url):
    next = True
    url = 'https://api.logicahealth.org/stratfhireducation/open/Observation?subject=' + old_id + '&code=2093-3'
    while next == True:
        #Check to see if we will need to handle another bundle after this current one
        next,url,bundle = next_bundle(url)
        #Parse resources in the current bundle
        for r in bundle['entry']:
            try:
                obs = r['resource']
                obs['subject']['reference'] = 'Patient/' + new_id
                new = {'resource': obs, 'request': {'method': 'POST', 'url': 'Observation'}}
                copy = reset_new_bundle()
                copy['entry'].append(new)
                requests.post(hspc,json=copy)
            except:
                pass

#SEND HDL CHOLESTEROL
def hdl_chol(old_id, new_id, new_url):
    next = True
    url = 'https://api.logicahealth.org/stratfhireducation/open/Observation?subject=' + old_id + '&code=2085-9'
    while next == True:
        #Check to see if we will need to handle another bundle after this current one
        next,url,bundle = next_bundle(url)
        #Parse resources in the current bundle
        for r in bundle['entry']:
            try:
                obs = r['resource']
                obs['subject']['reference'] = 'Patient/' + new_id
                new = {'resource': obs, 'request': {'method': 'POST', 'url': 'Observation'}}
                copy = reset_new_bundle()
                copy['entry'].append(new)
                requests.post(hspc,json=copy)
            except:
                pass

def valueSet(new_url):
    b = reset_new_bundle()
    r =json.loads('''
        {
            "resourceType": "ValueSet",
            "text": {
                "status": "generated",
                "div": "<div xmlns='http://www.w3.org/1999/xhtml'><a name='mm'/></div>"
            },
            "id": "cf-1561094099678",
            "expansion": {
                "timestamp": "2019-06-20T17:00:49.192Z",
                "total": 5,
                "contains": [
                    {
                        "code": "259255",
                        "display": "Atorvastatin 80 MG Oral Tablet"
                    },
                    {
                        "code": "833036",
                        "display": "Captopril 25 MG Oral Tablet"
                    },
                    {
                        "code": "197361",
                        "display": "Amlodipine 5 MG Oral Tablet"
                    },
                    {
                        "code": "309362",
                        "display": "Clopidogrel 75 MG Oral Tablet"
                    },
                    {
                        "code": "312961",
                        "display": "Simvastatin 20 MG Oral Tablet"
                    }
                ]
            },
            "title": "blood-pressure-medications"
        }
        '''
    )
    new = {'resource': r, 'request': {'method': 'POST', 'url': 'ValueSet'}}
    b['entry'].append(new)
    response = requests.post(new_url, json=b)

if __name__ == '__main__':
    new_url = sys.argv[1]
    ids = ['422', '378', '338', '672', '260', '588', '538', '191', '467', '3']
    valueSet(new_url)
    for old_id in ids:
        print('Transferring patient: ' + old_id)
        new_id = pat(old_id, new_url)
        obs(old_id,new_id, new_url)
        total_chol(old_id,new_id, new_url)
        hdl_chol(old_id,new_id, new_url)
        med(old_id,new_id, new_url)
