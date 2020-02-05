let express = require('express');
let bodyParser = require('body-parser');
let app = express();

// This is necessary middleware to parse JSON into the incoming request body for POST requests
app.use(bodyParser.json());

/**
 * Security Considerations:
 * - CDS Services must implement CORS in order to be called from a web browser
 */
app.use((request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Expose-Headers', 'Origin, Accept, Content-Location, ' +
        'Location, X-Requested-With');

    // Pass to next layer of middleware
    next();
});

/**
 * Authorization.
 * - CDS Services should only allow calls from trusted CDS Clients
 */
app.use((request, response, next) => {
    // Always allow OPTIONS requests as part of CORS pre-flight support.
    if (request.method === 'OPTIONS') {
        next();
        return;
    }

    let serviceHost = request.get('Host');
    let authorizationHeader = request.get('Authorization') || 'Bearer open'; // Default a token until ready to enable auth.

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer')) {
        response.set('WWW-Authenticate', `Bearer realm="${serviceHost}", error="invalid_token", error_description="No Bearer token provided."`)
        return response.status(401).end();
    }

    let token = authorizationHeader.replace('Bearer ', '');
    let aud = `${request.protocol}://${serviceHost}${request.originalUrl}`;

    let isValid = true; // Verify token validity per https://cds-hooks.org/specification/1.0/#trusting-cds-client

    if (!isValid) {
        response.set('WWW-Authenticate', `Bearer realm="${serviceHost}", error="invalid_token", error_description="Token error description."`)
        return response.status(401).end();
    }

    // Pass to next layer of middleware
    next();
});

/**
 * Discovery Endpoint:
 * - A GET request to the discovery endpoint, or URL path ending in '/cds-services'
 * - This function should respond with definitions of each CDS Service for this app in JSON format
 * - See details here: http://cds-hooks.org/specification/1.0/#discovery
 */
app.get('/cds-services', (request, response) => {

    // Example service to invoke the patient-view hook
    let patientViewExample = {
        hook: 'patient-view',
        id: 'fram-patient-view',
        title: 'Framingham patient-view',
        description: 'Performs a Framingham risk calculation with patient-view hook',
        prefetch: {
            // Request the Patient FHIR resource for the patient in context, where the EHR fills out the prefetch template
            // See details here: http://cds-hooks.org/specification/1.0/#prefetch-template
            patient_pre: 'Patient/{{context.patientId}}',
            smoker_pre: 'Observation?subject={{context.patientId}}&_sort:desc=date&code=72166-2&_count=1',
            sys_pre: 'Observation?subject={{context.patientId}}&_sort:desc=date&code=55284-4&_count=1',
            total_chol_pre: 'Observation?subject={{context.patientId}}&_sort:desc=date&code=2093-3&_count=1',
            hdl_chol_pre: 'Observation?subject={{context.patientId}}&_sort:desc=date&code=2085-9&_count=1',
            bp_med_pre: 'MedicationRequest?subject={{context.patientId}}&code=259255,833036,197361,309362,312961'
        }
    };

    // Example service to invoke the order-select hook
    let orderSelectExample = {
        hook: 'order-select',
        id: 'order-select-example',
        title: 'Example order-select CDS Service',
        description: 'Suggests prescribing Aspirin 81 MG Oral Tablets',
        prefetch: {
            patient_pre: 'Patient/{{context.patientId}}'
        }
    };

    let discoveryEndpointServices = {
        services: [ patientViewExample, orderSelectExample ]
    };
    response.send(JSON.stringify(discoveryEndpointServices, null, 2));
});

/**
 * Patient View Example Service:
 * - Handles POST requests to our patient-view-example endpoint
 * - This function should respond with an array of card(s) in JSON format for the patient-view hook
 *
 * - Service purpose: Display the Framingham risk of the patient with a link to our SMART app
 */
app.post('/cds-services/fram-patient-view', (request, response) => {
    // Parse the request body for the Patient prefetch resource
    let p = request.body.prefetch.patient_pre;
    let name = p.name[0].given[0] + ' ' + p.name[0].family;
    let gender = p.gender;
    let birthYear = p.birthDate.split('-')[0];
    let today = new Date();
    let currentYear = today.getFullYear();
    let age = currentYear - birthYear;
    //Smoker status
    let smoker_pre = request.body.prefetch.smoker_pre;
    let smoking_code = 0;
    let smoking_display = 'Never smoker';
    if (smoker_pre.total !== 0) {
        smoker_pre.entry.forEach(entry => {
            if (entry.resource.valueCodeableConcept.text !== 'Never smoker') {
                smoking_display = entry.resource.valueCodeableConcept.text;
                smoking_code = 1;
            }
        })
    }
    //Systolic BP
    let sys_bp = '';
    let sys_pre = request.body.prefetch.sys_pre;
    if (sys_pre.total !== 0) {
        sys_pre.entry[0].resource.component.forEach(comp => {
            if (comp.code.text === 'Systolic Blood Pressure') {
                sys_bp = comp.valueQuantity.value;
            }
        });
    }
    else {
        //Don't return a suggestion card if the calculation can't be performed
        return {"cards": []}
    }
    //Total Cholesterol
    let total_chol_pre = request.body.prefetch.total_chol_pre;
    let total_chol;
    if (total_chol_pre.total !== 0){
        total_chol = total_chol_pre.entry[0].resource.valueQuantity.value;
    }
    else{
        //Don't return a suggestion card if the calculation can't be performed
        return {"cards": []}
    }
    //HDL Cholesterol
    let hdl_chol_pre = request.body.prefetch.hdl_chol_pre;
    let hdl_chol = 0;
    if (hdl_chol_pre.total !== 0){
        hdl_chol = hdl_chol_pre.entry[0].resource.valueQuantity.value;
    }
    else{
        //Don't return a suggestion card if the calculation can't be performed
        return {"cards": []}
    }
    //Treated with BP meds?
    let treated = 0;
    let bp_med_display = 'No';
    if(request.body.prefetch.bp_med_pre.entry){
        treated = 1;
        bp_med_display = 'Yes'
    }
    let r;
    let display;
    if(gender === 'male'){
        r = male_fram(age, smoking_code, total_chol, hdl_chol, sys_bp, treated);
    }
    else{
        r = female_fram(age, smoking_code, total_chol, hdl_chol, sys_bp, treated);
    }
    let risk = r[0];
    if (risk === 'old'){
        display = 'Risk can only be calculated for ages 30-79'
    }
    else{
        let avg = r[1];
        if(avg === '<1') {
            avg = 1;
        }
        if (avg === 'old'){
            display = '10-year risk of MI or death: ' + risk.toFixed(2) + '% (No average reference above 74 years old)'
        }
        else {
            if (risk > parseFloat(avg)) {
                display = '10-year risk of MI or death: ' + risk.toFixed(2) + '%  (Average: ' + avg + '%)';
            }
            else {
                return {"cards": []}
            }
        }
    }
    let patientViewCard = createPatientViewCard(display,name,gender,age,smoking_display,sys_bp,total_chol,hdl_chol,bp_med_display);
    response.send(JSON.stringify(patientViewCard, null, 2));
});

function createPatientViewCard(r, name, gender, age, smoker, systolic, total_chol, hdl_chol, bp_med_display){
    return {
        cards: [
            {
                // Use the patient's First and Last name
                summary: r,
                detail: '<details><summary>Data used for calculation</summary><pre><code>' +
                    'Name:\t\t\t\t' + name +
                    '\nGender:\t\t\t\t' + gender +
                    '\nAge:\t\t\t\t' + age.toString() +
                    '\nSmoking status:\t\t\t' + smoker +
                    '\nSystolic blood pressure:\t' + systolic +
                    '\nTotal Cholesterol:\t\t' + total_chol +
                    '\nHDL Cholesterol:\t\t' + hdl_chol +
                    '\nBlood pressure medications?\t' + bp_med_display +
                    '</code></pre></details>',
                indicator: 'info',

                source: {
                    label: 'based on the Framingham Risk Calculator from MDCALC',
                    url: 'https://www.mdcalc.com/framingham-risk-score-hard-coronary-heart-disease#evidence'
                },
                links: [
                    {
                        label: 'Click to launch the Framingham Risk calculator SMART app',
                        url: 'http://localhost:5000/smart-launch',
                        type: 'smart'
                    }
                ]
            }
        ]
    };
}

/**
 * Order Select Example Service:
 * - Handles POST requests to the order-select-example endpoint
 * - This function should respond with an array of cards in JSON format for the order-select hook
 *
 * - Service purpose: determine if the medication to be ordered is in our collection of blood pressure medications,
 * then warn the ordering clinician it may increase the patient's Framingham risk and link to our SMART app
 */
app.post('/cds-services/order-select-example', (request, response) => {

    // Parse the request body for the FHIR context provided by the EHR. In this case, the MedicationRequest/MedicationOrder resource
    let draftOrder = request.body.context.draftOrders.entry[0].resource;
    let selections = request.body.context.selections;

    // Check if a medication was chosen by the provider to be ordered
    if (['MedicationRequest', 'MedicationOrder'].includes(draftOrder.resourceType) && selections.includes(`${draftOrder.resourceType}/${draftOrder.id}`)
        && draftOrder.medicationCodeableConcept) {
        const responseCard = createMedicationResponseCard(request, draftOrder); // see function below for more details
        response.send(JSON.stringify(responseCard, null, 2));
    }
    response.status(200);
});

/**
 * Creates a Card array based upon the medication chosen by the provider in the request context
 * @param context - The FHIR context of the medication being ordered by the provider
 * @returns {{cards: *[]}} - Either a card with the suggestion to switch medication or a textual info card
 */
function createMedicationResponseCard(request, context) {
    let providerOrderedMedication = context.medicationCodeableConcept.coding[0].code;
    let bp_med_set = ['259255','833036','197361','309362','312961'];
    if (bp_med_set.includes(providerOrderedMedication)) {
        return {
            cards: [
                {
                    summary: 'Warning: this medication may raise the patient\'s risk of MI or death',
                    indicator: 'warning',
                    links: [
                        {
                            label: 'Click to launch the Framingham Risk calculator SMART app',
                            url: 'http://localhost:5000/smart-launch',
                            type: 'smart'
                        }
                    ]
                }
            ]
        }
    }
}

let male_avg = {'1%':[30,31,32,33,34],'4%':[35,36,37,38,39,40,41,42,43,44],'8%':[45,46,47,48,49],'10%':[50,51,52,53,54],
    '13%':[55,56,57,58,59],'20%':[60,61,62,63,64],'22%':[65,66,67,68,69],'25%':[70,71,72,73,74]};
let female_avg = {'<1%':[30,31,32,33,34,35,36,37,38,39],'1%':[40,41,42,43,44],'2%':[45,46,47,48,49],
    '3%':[50,51,52,53,54], '7%':[55,56,57,58,59],'8%':[60,61,62,63,64,65,66,67,68,69],'11%':[70,71,72,73,74]};

/**
 * This function calculated the risk for male patients using the formula found here:
 * https://www.mdcalc.com/framingham-risk-score-hard-coronary-heart-disease#evidence
 * @returns {string}
 */
function male_fram(age,smoker,total_chol,hdl_chol,sys_bp,treated){
    let age_smoke = '';
    if(age < 30 || age > 79){
        return ['old']
    }
    if(age > 70){
        age_smoke = 70;
    }
    else{
        age_smoke = age;
    }
    let l = 52.000961*Math.log(age) + 20.014077*Math.log(total_chol) + -0.905964*Math.log(hdl_chol) +
        1.305784*Math.log(sys_bp) + 0.241549*treated + 12.096316*smoker + -4.605038*Math.log(age)*Math.log(total_chol) +
        -2.84367*Math.log(age_smoke)*smoker + -2.93323*Math.log(age)*Math.log(age) - 172.300168;
    let prob = 1 - Math.pow(0.9402,Math.exp(l));
    if (age > 75){
        return [prob*100, 'old'];
    }
    else{
        for(let key in male_avg){
            let range = male_avg[key];
            if(range.includes(age)){
                return [prob*100, key.slice(0,-1)];
            }
        }
    }
}

/**
 * This function calculated the risk for female patients using the formula found here:
 * https://www.mdcalc.com/framingham-risk-score-hard-coronary-heart-disease#evidence
 * @returns [risk,average]
 */
function female_fram(age,smoker,total_chol,hdl_chol,sys_bp,treated){
    let age_smoke = '';
    if(age < 30 || age > 79){
        return ['old'];
    }
    if(age > 78){
        age_smoke = 78;
    }
    else{
        age_smoke = age;
    }
    let l = 31.764001*Math.log(age) + 22.465206*Math.log(total_chol) + -1.187731*Math.log(hdl_chol) +
        2.552905*Math.log(sys_bp) + 0.420251*treated + 13.07543*smoker + -5.060998*Math.log(age)*Math.log(total_chol) +
        -2.996945*Math.log(age_smoke)*smoker - 146.5933061;
    let prob = 1 - Math.pow(0.98767,Math.exp(l));
    if (age > 75){
        return [prob*100, 'old'];
    }
    else{
        for(let key in female_avg){
            let range = female_avg[key];
            if(range.includes(age)){
                return [prob*100, key.slice(0,-1)];
            }
        }
    }
}

// Here is where we define the port for the localhost server to setup
app.listen(3000);
