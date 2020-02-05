# Framingham App - Starter
This is the most basic template for the Framingham Risk Calculator in the FHIR Education package.
* Risk equations come from https://www.mdcalc.com/framingham-risk-score-hard-coronary-heart-disease#evidence
* Docker/Node server file architecture adapted from https://github.com/cerner/cds-services-tutorial/wiki

## Instructions
This example uses a Docker container to house the dependencies necessary for the service. Follow this
[guide](https://docs.docker.com/install/) to install Docker on your machine and check installation success with
<code>docker -v</code>. Then follow this [guide](https://docs.docker.com/compose/install/) to install Docker Compose
and check that installation with <code>docker-compose -v</code>.

To run the example, navigate to the root directory of the repository and use
<code>docker-compose up --build</code>

Navigate your web browser to [http://0.0.0.0:5000/](http://0.0.0.0:5000/) in order to view the example.
