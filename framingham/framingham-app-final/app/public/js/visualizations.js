function generateSysGauge(el, percent) {
    var Needle, arc, arcEndRad, arcStartRad, barWidth, chart, chartInset, degToRad, el, endPadRad, height, i, margin, needle, numSections, padRad, percToDeg, percToRad, percent, radius, ref, sectionIndx, sectionPerc, startPadRad, svg, totalPercent, width;
    //Number of sections you want in the gauge
    numSections = 4;
    padRad = 0;
    barWidth = 50;
    chartInset = 5;
    totalPercent = 0.75;
    margin = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    };
    width = el[0][0].offsetWidth - margin.left - margin.right;
    height = width;
    radius = Math.min(width, height) / 2;
    percToDeg = function (perc) {
        return perc * 360;
    };
    percToRad = function (perc) {
        return degToRad(percToDeg(perc));
    };
    degToRad = function (deg) {
        return deg * Math.PI / 180;
    };
    svg = el.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom);
    chart = svg.append('g').attr('transform', 'translate(' + (width + margin.left) / 2 + ', ' + (height + margin.top) / 2 + ')');
    for (sectionIndx = i = 1, ref = numSections; 1 <= ref ? i <= ref : i >= ref; sectionIndx = 1 <= ref ? ++i : --i) {
        //This loop will fun through the number of sections you indicate above
        if (sectionIndx === 1){
            //Set the percentage you want this section to take (divide by 2 so it is a horizontal gauge)
            sectionPerc = 0.17 / 2;
        }
        if (sectionIndx === 2){
            //Set the percentage you want this section to take (divide by 2 so it is a horizontal gauge)
            sectionPerc = 0.25 / 2;
        }
        if (sectionIndx === 3){
            //Set the percentage you want this section to take (divide by 2 so it is a horizontal gauge)
            sectionPerc = 0.17 / 2;
        }
        if (sectionIndx === 4){
            //Set the percentage you want this section to take (divide by 2 so it is a horizontal gauge)
            sectionPerc = 0.41 / 2;
        }
        arcStartRad = percToRad(totalPercent);
        arcEndRad = arcStartRad + percToRad(sectionPerc);
        totalPercent += sectionPerc;
        startPadRad = sectionIndx === 0 ? 0 : padRad / 2;
        endPadRad = sectionIndx === numSections ? 0 : padRad / 2;
        arc = d3.svg.arc().outerRadius(radius - chartInset).innerRadius(radius - chartInset - barWidth).startAngle(arcStartRad + startPadRad).endAngle(arcEndRad - endPadRad);
        let seg = chart.append('path').attr('class', 'arc chart-color' + sectionIndx).attr('d', arc);
        // Customize a tooltip message to display when hovering over this section
        if (sectionIndx === 1){
            seg.on('mouseover', function() {
                d3.selectAll('#sys-tip').text('Low (70-90 mmHg)');
            })
        }
        // Customize a tooltip message to display when hovering over this section
        if (sectionIndx === 2){
            seg.on('mouseover', function() {
                d3.selectAll('#sys-tip').text('Normal (90-120 mmHg)');
            })
        }
        // Customize a tooltip message to display when hovering over this section
        if (sectionIndx === 3){
            seg.on('mouseover', function() {
                d3.selectAll('#sys-tip').text('Elevated (120-140 mmHg)');
            })
        }
        // Customize a tooltip message to display when hovering over this section
        if (sectionIndx === 4){
           seg.on('mouseover', function() {
                d3.selectAll('#sys-tip').text('High (140-190 mmHg)');
            })
        }
        // Remove the tooltip message when no longer hovering over the section
        seg.on('mouseout', function() {
            d3.selectAll('#sys-tip').text('')
        });
        //Display the value being shown in the visualization
        chart.append('text').attr('class','h1 jumbotron-heading').attr('y',60).attr('text-anchor','middle').text(percent);
        //Display the units for the value in the visualization
        chart.append('text').attr('class','h6').attr('y',80).attr('text-anchor','middle').text('mmHg').style('stroke-opacity', '.2');
    }
    Needle = function () {
        function Needle(len, radius1) {
            this.len = len;
            this.radius = radius1;
        }
        Needle.prototype.drawOn = function (el, perc) {
            el.append('circle').attr('class', 'needle-center').attr('cx', 0).attr('cy', 0).attr('r', this.radius);
            return el.append('path').attr('class', 'needle').attr('d', this.mkCmd(perc));
        };
        Needle.prototype.animateOn = function (el, perc) {
            var self;
            self = this;
            return el.transition().delay(200).ease('elastic').duration(3000).selectAll('.needle').tween('progress', function () {
                return function (percentOfPercent) {
                    var progress;
                    progress = percentOfPercent * perc;
                    return d3.select(this).attr('d', self.mkCmd(progress));
                };
            });
        };
        Needle.prototype.mkCmd = function (perc) {
            var centerX, centerY, leftX, leftY, rightX, rightY, thetaRad, topX, topY;
            thetaRad = percToRad(perc / 2);
            centerX = 0;
            centerY = 0;
            topX = centerX - this.len * Math.cos(thetaRad);
            topY = centerY - this.len * Math.sin(thetaRad);
            leftX = centerX - this.radius * Math.cos(thetaRad - Math.PI / 2);
            leftY = centerY - this.radius * Math.sin(thetaRad - Math.PI / 2);
            rightX = centerX - this.radius * Math.cos(thetaRad + Math.PI / 2);
            rightY = centerY - this.radius * Math.sin(thetaRad + Math.PI / 2);
            return 'M ' + leftX + ' ' + leftY + ' L ' + topX + ' ' + topY + ' L ' + rightX + ' ' + rightY;
        };
        return Needle;
    }();
    needle = new Needle(90, 15);
    needle.drawOn(chart, 0);
    //Use a D3 scale to translate the value to a percentage readable by the needle (as explained in README)
    let linearScale = d3.scale.linear().domain([70,190]).range([0,1]);
    needle.animateOn(chart, linearScale(percent));
}

function generateTotalGauge(el, percent) {
    var Needle, arc, arcEndRad, arcStartRad, barWidth, chart, chartInset, degToRad, el, endPadRad, height, i, margin, needle, numSections, padRad, percToDeg, percToRad, percent, radius, ref, sectionIndx, sectionPerc, startPadRad, svg, totalPercent, width;
    numSections = 3;
    padRad = 0;
    barWidth = 50;
    chartInset = 5;
    totalPercent = 0.75;
    margin = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    };
    width = el[0][0].offsetWidth - margin.left - margin.right;
    height = width;
    radius = Math.min(width, height) / 2;
    percToDeg = function (perc) {
        return perc * 360;
    };
    percToRad = function (perc) {
        return degToRad(percToDeg(perc));
    };
    degToRad = function (deg) {
        return deg * Math.PI / 180;
    };
    svg = el.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom);
    chart = svg.append('g').attr('transform', 'translate(' + (width + margin.left) / 2 + ', ' + (height + margin.top) / 2 + ')');
    for (sectionIndx = i = 1, ref = numSections; 1 <= ref ? i <= ref : i >= ref; sectionIndx = 1 <= ref ? ++i : --i) {
        if (sectionIndx === 1){
            sectionPerc = 0.34 / 2;
        }
        if (sectionIndx === 2){
            sectionPerc = 0.26 / 2;
        }
        if (sectionIndx === 3){
            sectionPerc = 0.4 / 2;
        }
        arcStartRad = percToRad(totalPercent);
        arcEndRad = arcStartRad + percToRad(sectionPerc);
        totalPercent += sectionPerc;
        startPadRad = sectionIndx === 0 ? 0 : padRad / 2;
        endPadRad = sectionIndx === numSections ? 0 : padRad / 2;
        arc = d3.svg.arc().outerRadius(radius - chartInset).innerRadius(radius - chartInset - barWidth).startAngle(arcStartRad + startPadRad).endAngle(arcEndRad - endPadRad);
        let color = parseInt(sectionIndx) + 1;
        let seg = chart.append('path').attr('class', 'arc chart-color' + color.toString()).attr('d', arc);
        if (sectionIndx === 1){
            seg.on('mouseover', function() {
                d3.selectAll('#total-tip').text('Normal (under 200 mg/dL)');
            })
        }
        if (sectionIndx === 2){
            seg.on('mouseover', function() {
                d3.selectAll('#total-tip').text('Borderline (200-240 mg/dL)');
            })
        }
        if (sectionIndx === 3){
            seg.on('mouseover', function() {
                d3.selectAll('#total-tip').text('High (over 240 mg/dL)');
            })
        }
        seg.on('mouseout', function() {
            d3.selectAll('#total-tip').text('')
        });
        chart.append('text').attr('class','h1 jumbotron-heading').attr('y',60).attr('text-anchor','middle').text(percent);
        chart.append('text').attr('class','h6').attr('y',80).attr('text-anchor','middle').text('mg/dL').style('stroke-opacity', '.2');
    }
    Needle = function () {
        function Needle(len, radius1) {
            this.len = len;
            this.radius = radius1;
        }
        Needle.prototype.drawOn = function (el, perc) {
            el.append('circle').attr('class', 'needle-center').attr('cx', 0).attr('cy', 0).attr('r', this.radius);
            return el.append('path').attr('class', 'needle').attr('d', this.mkCmd(perc));
        };
        Needle.prototype.animateOn = function (el, perc) {
            var self;
            self = this;
            return el.transition().delay(200).ease('elastic').duration(3000).selectAll('.needle').tween('progress', function () {
                return function (percentOfPercent) {
                    var progress;
                    progress = percentOfPercent * perc;
                    return d3.select(this).attr('d', self.mkCmd(progress));
                };
            });
        };
        Needle.prototype.mkCmd = function (perc) {
            var centerX, centerY, leftX, leftY, rightX, rightY, thetaRad, topX, topY;
            thetaRad = percToRad(perc / 2);
            centerX = 0;
            centerY = 0;
            topX = centerX - this.len * Math.cos(thetaRad);
            topY = centerY - this.len * Math.sin(thetaRad);
            leftX = centerX - this.radius * Math.cos(thetaRad - Math.PI / 2);
            leftY = centerY - this.radius * Math.sin(thetaRad - Math.PI / 2);
            rightX = centerX - this.radius * Math.cos(thetaRad + Math.PI / 2);
            rightY = centerY - this.radius * Math.sin(thetaRad + Math.PI / 2);
            return 'M ' + leftX + ' ' + leftY + ' L ' + topX + ' ' + topY + ' L ' + rightX + ' ' + rightY;
        };
        return Needle;
    }();
    needle = new Needle(90, 15);
    needle.drawOn(chart, 0);
    let linearScale = d3.scale.linear().domain([150,300]).range([0,1]);
    needle.animateOn(chart, linearScale(percent));
}

function generateHDLGauge(el, percent) {
    var Needle, arc, arcEndRad, arcStartRad, barWidth, chart, chartInset, degToRad, el, endPadRad, height, i, margin, needle, numSections, padRad, percToDeg, percToRad, percent, radius, ref, sectionIndx, sectionPerc, startPadRad, svg, totalPercent, width;
    numSections = 3;
    padRad = 0;
    barWidth = 50;
    chartInset = 5;
    totalPercent = 0.75;
    margin = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    };
    width = el[0][0].offsetWidth - margin.left - margin.right;
    height = width;
    radius = Math.min(width, height) / 2;
    percToDeg = function (perc) {
        return perc * 360;
    };
    percToRad = function (perc) {
        return degToRad(percToDeg(perc));
    };
    degToRad = function (deg) {
        return deg * Math.PI / 180;
    };
    svg = el.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom);
    chart = svg.append('g').attr('transform', 'translate(' + (width + margin.left) / 2 + ', ' + (height + margin.top) / 2 + ')');
    for (sectionIndx = i = 1, ref = numSections; 1 <= ref ? i <= ref : i >= ref; sectionIndx = 1 <= ref ? ++i : --i) {
        let color;
        if (sectionIndx === 1){
            sectionPerc = 0.43 / 2;
            color = '4';
        }
        if (sectionIndx === 2){
            sectionPerc = 0.16 / 2;
            color = '3';
        }
        if (sectionIndx === 3){
            sectionPerc = 0.41 / 2;
            color = '2';
        }
        arcStartRad = percToRad(totalPercent);
        arcEndRad = arcStartRad + percToRad(sectionPerc);
        totalPercent += sectionPerc;
        startPadRad = sectionIndx === 0 ? 0 : padRad / 2;
        endPadRad = sectionIndx === numSections ? 0 : padRad / 2;
        arc = d3.svg.arc().outerRadius(radius - chartInset).innerRadius(radius - chartInset - barWidth).startAngle(arcStartRad + startPadRad).endAngle(arcEndRad - endPadRad);
        let seg = chart.append('path').attr('class', 'arc chart-color' + color.toString()).attr('d', arc);
        if (sectionIndx === 1){
            seg.on('mouseover', function() {
                d3.selectAll('#hdl-tip').text('Low (under 50 mg/dL)');
            })
        }
        if (sectionIndx === 2){
            seg.on('mouseover', function() {
                d3.selectAll('#hdl-tip').text('Borderline (50-59 mg/dL)');
            })
        }
        if (sectionIndx === 3){
            seg.on('mouseover', function() {
                d3.selectAll('#hdl-tip').text('Desirable (over 60 mg/dL)');
            })
        }
        seg.on('mouseout', function() {
            d3.selectAll('#hdl-tip').text('')
        });
        chart.append('text').attr('class','h1 jumbotron-heading').attr('y',60).attr('text-anchor','middle').text(percent);
        chart.append('text').attr('class','h6').attr('y',80).attr('text-anchor','middle').text('mg/dL').style('stroke-opacity', '.2');
    }
    Needle = function () {
        function Needle(len, radius1) {
            this.len = len;
            this.radius = radius1;
        }
        Needle.prototype.drawOn = function (el, perc) {
            el.append('circle').attr('class', 'needle-center').attr('cx', 0).attr('cy', 0).attr('r', this.radius);
            return el.append('path').attr('class', 'needle').attr('d', this.mkCmd(perc));
        };
        Needle.prototype.animateOn = function (el, perc) {
            var self;
            self = this;
            return el.transition().delay(200).ease('elastic').duration(3000).selectAll('.needle').tween('progress', function () {
                return function (percentOfPercent) {
                    var progress;
                    progress = percentOfPercent * perc;
                    return d3.select(this).attr('d', self.mkCmd(progress));
                };
            });
        };
        Needle.prototype.mkCmd = function (perc) {
            var centerX, centerY, leftX, leftY, rightX, rightY, thetaRad, topX, topY;
            thetaRad = percToRad(perc / 2);
            centerX = 0;
            centerY = 0;
            topX = centerX - this.len * Math.cos(thetaRad);
            topY = centerY - this.len * Math.sin(thetaRad);
            leftX = centerX - this.radius * Math.cos(thetaRad - Math.PI / 2);
            leftY = centerY - this.radius * Math.sin(thetaRad - Math.PI / 2);
            rightX = centerX - this.radius * Math.cos(thetaRad + Math.PI / 2);
            rightY = centerY - this.radius * Math.sin(thetaRad + Math.PI / 2);
            return 'M ' + leftX + ' ' + leftY + ' L ' + topX + ' ' + topY + ' L ' + rightX + ' ' + rightY;
        };
        return Needle;
    }();
    needle = new Needle(90, 15);
    needle.drawOn(chart, 0);
    let linearScale = d3.scale.linear().domain([20,90]).range([0,1]);
    needle.animateOn(chart, linearScale(percent));
}
