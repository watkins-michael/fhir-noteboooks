//This is the base URL for the server
let base = 'https://api.logicahealth.org/stratfhireducation/open/';
//These are average risks for certain age groups taken from here:
//  https://www.mdcalc.com/framingham-risk-score-hard-coronary-heart-disease#evidence
let male_avg = {'1%':[30,31,32,33,34],'4%':[35,36,37,38,39,40,41,42,43,44],'8%':[45,46,47,48,49],'10%':[50,51,52,53,54],
    '13%':[55,56,57,58,59],'20%':[60,61,62,63,64],'22%':[65,66,67,68,69],'25%':[70,71,72,73,74]};
let female_avg = {'<1%':[30,31,32,33,34,35,36,37,38,39],'1%':[40,41,42,43,44],'2%':[45,46,47,48,49],
    '3%':[50,51,52,53,54], '7%':[55,56,57,58,59],'8%':[60,61,62,63,64,65,66,67,68,69],'11%':[70,71,72,73,74]};

/**
 * Functions which query the server must be async in order to wait until the response is received.
 *
 * This function is activated onClick for the 'Launch Calculator' button in the HTML. It calls out to functions which
 * query the server for the FHIR resources needed by the calculation functions.
 */
async function launch(){
    //Fetch conformance statement for server to verify it is working properly
    try{
        document.getElementById('risk_result').innerHTML ='---INFO---\n' + 'Checking server: ' + base;
        await fetch(base + 'metadata');
    }
    catch{
        document.getElementById('risk_result').innerHTML ='---ERROR---\n' + 'Conformance failed for server: ' + base;
        return;
    }
    //Continue with calculation
    let result = '';
    //Retrieve patient_id from the input field in the HTML
    let patient_id = document.getElementById('patient_id_input').value;
    //Return error if no patient ID is entered
    if(patient_id === ''){
        document.getElementById('risk_result').innerHTML ='---ERROR---\n' + 'No patient ID entered';
        return;
    }
    //Query for the patient resource for name, gender, and age. Format responses for a clean result display.
    let d = await demographics(patient_id);
    //Demographics response array should look like: [name,gender,age], unless an error has occurred: [error]
    if(d[0] === 'error'){
        document.getElementById('risk_result').innerHTML ='---ERROR---\n' + 'No patient in server with ID: ' + patient_id;
        return;
    }
    let name = d[0];
    result += 'Name:\t\t\t\t\t' + name + '\n';
    let gender = d[1];
    result += 'Gender:\t\t\t\t\t' + gender + '\n';
    let age = d[2];
    result += 'Age:\t\t\t\t\t' + age.toString() + '\n';
    //Query for observation resources for smoking status, and systolic BP. Format for clean display.
    let smoker = await smoking_status(patient_id);
    if(smoker === 1){
        result += 'Smoker:\t\t\t\t\tYES\n';
    }else{result += 'Smoker:\t\t\t\t\tNO\n';}
    let sys_bp = await systolic(patient_id);
    if(sys_bp === 'error'){
        document.getElementById('risk_result').innerHTML ='---ERROR---\n' + 'No Systolic Blood Pressure values detected for: ' + name;
        return;
    }
    result += 'Systolic BP:\t\t\t\t' + sys_bp.toString() + '\n';
    //Query for DiagnosticReport resource for ID's to Observation resources for Total cholesterol and HDL cholesterol
    let c = await cholesterol(patient_id);
    //Cholesterol response array should look like: [total_chol, hdl_chol], unless an error has occurred: [error]
    if(c[0] === 'error'){
        document.getElementById('risk_result').innerHTML ='---ERROR---\nNo Lipid Panel found for: ' + name;
        return;
    }
    let total_chol = c[0];
    result += 'Total Cholesterol:\t\t\t' + total_chol.toString() + '\n';
    let hdl_chol = c[1];
    result += 'HDL Cholesterol:\t\t\t' + hdl_chol.toString() + '\n';
    //Query for MedicationRequest resources to determine if blood pressure medications are being taken
    let treated = await bp_med_status(patient_id);
    if(treated === 1){
        result += 'Blood Pressure treated by medication:\tYES\n';
    }else{result += 'Blood Pressure treated by medication:\tNO\n';}

    //Send variables to calculator functions and format results
    result += '--------RESULT--------\n';
    let r;
    //Send all the gathered data to calculator functions by gender
    if(gender === 'female'){
        r = await female_fram(age,smoker,total_chol,hdl_chol,sys_bp,treated);
    }
    else{
        r = await male_fram(age,smoker,total_chol,hdl_chol,sys_bp,treated);
    }
    console.log(r);
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
    document.getElementById('risk_result').innerHTML = result;
}

/**
 * @returns [name,gender,age] or [error]
 */
async function demographics(patient_id){
    let arr = [];
    try{
        let response = await fetch(base + 'Patient?_id=' + patient_id);
        //Convert bundle into json
        let bundle = await response.json();
        //Parse bundle
        let patient = bundle.entry[0].resource;
        console.log(patient);
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
 *
 * @returns smoker
 */
async function smoking_status(patient_id){
    let url = base + 'Observation?subject=' + patient_id + '&_sort:desc=date&code=72166-2&_count=1';
    //Default smoking status is 1 (Yes)
    let smoker = 1;
    //Send the query
    let response = await fetch(url);
    let bundle = await response.json();
    //If the query returns smoking status observations, check for 'Never Smoker', otherwise, keep the default
    if (bundle.total !== 0) {
        if (bundle.entry[0].resource.valueCodeableConcept.text === 'Never smoker'){
            smoker = 0;
        }
    }
    return smoker;
}

/**
 * Sys_bp = the systolic blood pressure of the patient
 *
 * @returns sys_bp or 'error'
 */
async function systolic(patient_id){
    //Most recent systolic BP reading for patient
    let url = base + 'Observation?subject=' + patient_id + '&_sort:desc=date&code=55284-4&_count=1';
    //Send the query
    let response = await fetch(url);
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
 * Total_chol = Total Cholesterol result from most recent Lipid Panel of patient
 * Hdl_chol = High Density Lipoprotein Cholesterol result from most recent Lipid Panel of patient
 *
 * @returns [total_chol,hdl_chol] or [error]
 */
async function cholesterol(patient_id){
    //Query for the most recent Total cholesterol observation
    let url = base + 'Observation?subject=' + patient_id + '&_sort:desc=date&code=2093-3&_count=1';
    //Send the query
    let response = await fetch(url);
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
    url = base + 'Observation?subject=' + patient_id + '&_sort:desc=date&code=2085-9&_count=1';
    //Send the query
    response = await fetch(url);
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
 * @returns treated
 */
async function bp_med_status(patient_id){
    let url = base + 'MedicationRequest?subject=' + patient_id + '&code=';
    //First, get ValueSet for BP medications
    let response = await fetch(base + 'ValueSet?title=blood-pressure-medications');
    let bundle = await response.json();
    for (let meds of bundle['entry'][0]['resource']['expansion']['contains']){
        //Add each code to the URL we will use for our MedicationRequest query
        url += meds['code'] + ',';
    }
    //Take out trailing comma
    url = url.slice(0,-1);
    console.log(url);
    //Query for MedicationRequest resources for thee patient
    //Default treated status is 0 (No)
    let treated = 0;
    //Send the query
    response = await fetch(url);
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
