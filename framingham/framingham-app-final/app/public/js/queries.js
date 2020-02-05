function loadPatient(){
    // get the URL parameters received from the authorization server
    let state = getUrlParameter("state");  // session key
    let code = getUrlParameter("code");    // authorization code

// load the app parameters stored in the session
    let params = JSON.parse(sessionStorage[state]);  // load app session
    let tokenUri = params.tokenUri;
    let clientId = params.clientId;
    let secret = params.secret;
    let serviceUri = params.serviceUri;
    let redirectUri = params.redirectUri;

// Prep the token exchange call parameters
    let data = {
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
    };
    let options;
    if (!secret) {
        data['client_id'] = clientId;
    }
    options = {
        url: tokenUri,
        type: 'POST',
        data: data
    };
    if (secret) {
        options['headers'] = {'Authorization': 'Basic ' + btoa(clientId + ':' + secret)};
    }

// obtain authorization token from the authorization service using the authorization code
    $.ajax(options).done(function(res){
        // should get back the access token and the patient ID
        let access_token = res.access_token;
        let patient_id = res.patient;
        main(patient_id, serviceUri, access_token);
    });

}

// Convenience function for parsing of URL parameters
// based on http://www.jquerybyexample.net/2012/06/get-url-parameters-using-jquery.html
function getUrlParameter(sParam) {
    let sPageURL = window.location.search.substring(1);
    let sURLVariables = sPageURL.split('&');
    for (let i = 0; i < sURLVariables.length; i++)
    {
        let sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            let res = sParameterName[1].replace(/\+/g, '%20');
            return decodeURIComponent(res);
        }
    }
}

//These are average risks for certain age groups taken from here:
//  https://www.mdcalc.com/framingham-risk-score-hard-coronary-heart-disease#evidence
let male_avg = {'1%':[30,31,32,33,34],'4%':[35,36,37,38,39,40,41,42,43,44],'8%':[45,46,47,48,49],'10%':[50,51,52,53,54],
    '13%':[55,56,57,58,59],'20%':[60,61,62,63,64],'22%':[65,66,67,68,69],'25%':[70,71,72,73,74]};
let female_avg = {'<1%':[30,31,32,33,34,35,36,37,38,39],'1%':[40,41,42,43,44],'2%':[45,46,47,48,49],
    '3%':[50,51,52,53,54], '7%':[55,56,57,58,59],'8%':[60,61,62,63,64,65,66,67,68,69],'11%':[70,71,72,73,74]};

/**
 * Functions which query the server must be async in order to wait until the response is received.
 */
async function main(patient_id, service_uri, access_token){
    let result = '';

    //Query for the patient resource for name, gender, and age. Format responses for a clean result display.
    let d = await demographics(patient_id, service_uri, access_token);
    //Demographics response array should look like: [name,gender,age], unless an error has occurred: [error]
    if(d[0] === 'error'){
        d3.select('#risk_result').text('Cannot access patient: ' + patient_id);
        return;
    }
    let name = d[0];
    d3.select('#patientName').text(name);
    let gender = d[1];
    let age = d[2];
    d3.select('#demographics').text(age.toString() + ' year-old ' + gender);

    //Query for smoking status. Format for clean display.
    let s = await smoking_status(patient_id, service_uri, access_token);
    let smoker = s[0];
    d3.select('#smoking_status').text(s[1]);

    //Query for systolic BP. Format for clean display.
    let sys_bp = await systolic(patient_id, service_uri, access_token);
    //Create the systolic gauge visualization
    if(sys_bp === 'error'){
        d3.select('#result').text('ERROR - No systolic blood pressure values detected');
        return;
    }
    generateSysGauge(d3.select("#sys-gauge"), parseInt(sys_bp));

    //Query for Total cholesterol and HDL cholesterol. Format for clean display
    let c = await cholesterol(patient_id, service_uri, access_token);
    //Cholesterol response array should look like: [total_chol, hdl_chol], unless an error has occurred: [error]
    if(c[0] === 'error'){
        d3.select('#result').text('ERROR - No cholesterol values detected');
        return;
    }
    let total_chol = c[0];
    generateTotalGauge(d3.select("#total-gauge"), parseInt(total_chol));
    let hdl_chol = c[1];
    generateHDLGauge(d3.select("#hdl-gauge"), parseInt(hdl_chol));

    //Query for MedicationRequest resources to determine if blood pressure medications are being taken
    let treated = await bp_med_status(patient_id, service_uri, access_token);
    if(treated === 1){
        d3.select('#treated').text('History of blood pressure medication: YES');
    }
    else{
        d3.select('#treated').text('History of blood pressure medication: NO');
    }

    let r;
    if(gender === 'female'){
        r = await female_fram(age,smoker,total_chol,hdl_chol,sys_bp,treated);
    }
    else{
        r = await male_fram(age,smoker,total_chol,hdl_chol,sys_bp,treated);
    }
    //If the patient is 80 or older, the calculation wasn't performed
    let risk = r[0];
    if (risk === 'old'){
        result += 'Risk can only be calculated for ages 30-79'
    }
    else{
        let avg = r[1];
        //If the patient is above 74 years old there is no 'Average' information to include in the result
        if (avg === 'old'){
            result += '10-year risk of MI or death: ' + risk.toFixed(2) + '% (No average reference above 74 years old)'
        }
        else {
            result += '10-year risk of MI or death: ' + risk.toFixed(2) + '%  (Average: ' + avg + '%)';
        }
    }
    //Display the result of the calculation
    d3.select('#result').text(result);
}


/**
 * @returns [name,gender,age] or [error]
 */
async function demographics(patient_id, service_uri, access_token){
    let arr = [];
    let url = service_uri + '/Patient?_id=' + patient_id;
    //Send the query with the SMART access token
    let request = new Request(url, {
        method: 'get',
        headers: {'Authorization': 'Bearer ' + access_token}
    });
    try{
        let response = await fetch(request);
        //Convert bundle into json
        let bundle = await response.json();
        //Parse bundle
        let patient = bundle.entry[0].resource;
        //Add name to response array
        arr.push(patient.name[0].given[0] + ' ' + patient.name[0].family);
        //Add gender to response array
        arr.push(patient.gender);
        //Pull birthYear to calculate age using Date() objects
        let birthYear = patient.birthDate.split('-')[0];
        let today = new Date();
        let currentYear = today.getFullYear();
        //Add age to response array
        arr.push(currentYear - birthYear);
        return arr;
    }
    catch{
        return ['error']
    }
}

/**
 * Smoker = variable representing the patient's smoking status (1 = Yes, 0 = No)
 * Smoker_display = variable containing the text form of the patient's smoking status
 *
 * @returns [smoker, smoker_display]
 */
async function smoking_status(patient_id, service_uri, access_token){
    //Most recent smoking status observation
    let url = service_uri + '/Observation?subject=' + patient_id + '&_sort:desc=date&code=72166-2&_count=1';
    //Default smoking status is 1 (Yes)
    let smoker = 1;
    let smoker_display;
    //Send the query with the SMART access token
    let request = new Request(url,{
        headers: new Headers({"Authorization": "Bearer " + access_token})
    });
    let response = await fetch(request);
    let bundle = await response.json();
    //If the query returns smoking status observations, check for 'Never Smoker', otherwise, keep the default
    if (bundle.total !== 0) {
        smoker_display = bundle.entry[0].resource.valueCodeableConcept.text;
        if (smoker_display === 'Never smoker'){
            smoker = 0;
        }
    }
    return [smoker, smoker_display];
}

/**
 * Sys_bp = the systolic blood pressure of the patient
 *
 * @returns sys_bp or 'error'
 */
async function systolic(patient_id, service_uri, access_token){
    //Most recent systolic BP reading for patient
    let url = service_uri + '/Observation?subject=' + patient_id + '&_sort:desc=date&code=55284-4&_count=1';
    //Send the query with the SMART access token
    let request = new Request(url,{
        headers: new Headers({"Authorization": "Bearer " + access_token})
    });
    let response = await fetch(request);
    let bundle = await response.json();
    //If there is a result
    if (bundle.total !== 0) {
        //Extract the systolic value
        for (let comp of bundle.entry[0].resource.component) {
            if (comp.code.text === 'Systolic Blood Pressure') {
                return comp.valueQuantity.value;
            }
        }
        return 'error'
    }
    else {
        return 'error'
    }
}

/**
 * Total_chol = most recent Total Cholesterol result
 * Hdl_chol = most recent High Density Lipoprotein Cholesterol result
 *
 * @returns [total_chol,hdl_chol] or [error]
 */
async function cholesterol(patient_id, service_uri, access_token){
    //Query for the most recent Total cholesterol observation
    let url = service_uri + '/Observation?subject=' + patient_id + '&_sort:desc=date&code=2093-3&_count=1';
    //Send the query with the SMART access token
    let request = new Request(url,{
        headers: new Headers({"Authorization": "Bearer " + access_token})
    });
    let response = await fetch(request);
    let bundle = await response.json();
    //Extract value
    let total_chol;
    if (bundle.total !== 0){
        total_chol = bundle.entry[0].resource.valueQuantity.value;
    }
    else{
        return ['error'];
    }
    //Query for the most recent HDL cholesterol observation
    url = service_uri + '/Observation?subject=' + patient_id + '&_sort:desc=date&code=2085-9&_count=1';
    request = new Request(url,{
        headers: new Headers({"Authorization": "Bearer " + access_token})
    });
    response = await fetch(request);
    bundle = await response.json();
    //Extract value
    let hdl_chol;
    if (bundle.total !== 0){
        hdl_chol = bundle.entry[0].resource.valueQuantity.value;
    }
    else{
        return ['error'];
    }
    return [total_chol,hdl_chol];
}

/**
 * Treated = variable representing whether or not the patient is taking blood pressure medications (Yes = 1, No = 0)
 *
 * @returns [treated]
 */
async function bp_med_status(patient_id, service_uri, access_token){
    let url = service_uri + '/MedicationRequest?subject=' + patient_id + '&code=';
    //First, get ValueSet for BP medications
    let request = new Request(service_uri + '/ValueSet?title=blood-pressure-medications',{
        headers: new Headers({"Authorization": "Bearer " + access_token})
    });
    let response = await fetch(request);
    let bundle = await response.json();
    for (let meds of bundle['entry'][0]['resource']['expansion']['contains']){
        //Add each code to the URL we will use for our MedicationRequest query
        url += meds['code'] + ',';
    }
    //Take out trailing comma
    url = url.slice(0,-1);
    console.log('BP ValueSet URL: ' + url);

    //Query for blood pressure medications being taken by the patient, could also use a FHIR ValueSet
    //Default treated status is 0 (No)
    let treated = 0;
    //Send the query with the SMART access token
    request = new Request(url,{
        headers: new Headers({"Authorization": "Bearer " + access_token})
    });
    response = await fetch(request);
    bundle = await response.json();
    //If any entries are returned then we know they are blood pressure medications
    if (bundle.entry){
        treated = 1;
    }
    return treated;
}

/**
 * This function calculated the risk for male patients using the formula found here:
 * https://www.mdcalc.com/framingham-risk-score-hard-coronary-heart-disease#evidence
 * @returns [risk,average] or [old] (meaning the patient is too young or too old for the calculation)
 */
function male_fram(age,smoker,total_chol,hdl_chol,sys_bp,treated){
    let age_smoke = '';
    //Patient is too young or too old for the calculation
    if(age < 30 || age > 79){
        return ['old'];
    }
    //See website above for explanation of alternative smoker ages
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
    //No average risk is available for patients 75 or older
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
 * @returns [risk,average] or [old] (meaning the patient is too young or too old for the calculation)
 */
function female_fram(age,smoker,total_chol,hdl_chol,sys_bp,treated){
    let age_smoke = '';
    //Patient is too young or too old for the calculation
    if(age < 30 || age > 79){
        return ['old'];
    }
    //See website above for explanation of alternative smoker ages
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
    //No average risk is available for patients 75 or older
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
