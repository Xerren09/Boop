function copyAddress(elementID) {
    var address = document.getElementById(elementID).innerText.toString().trim();
    navigator.clipboard.writeText(address);
} 

function displayProjectDetails(project = {}, insertElementTag) {
    console.log(project);
    const projectURL = `${document.location.protocol}//${document.domain}${(window.location.port ? ':' + window.location.port: '')}${project.route}`;
    const internalHostUrl = project.port == -1 ? "" : `
        <div class="addressDiv">
            <p><b>Internal address:</b><em id=${project.name}+"addr"> ${`http://localhost:${project.port}/`}</em></p>
            <button class="copy" onClick=copyAddress("${project.name+"addr"}")><i class="fas fa-copy"></i></button>
        </div>`;
    const eventString = "\n" + JSON.stringify(project.lastEvent, null, "  ");
    const configString = "\n" + JSON.stringify(project.config, null, "  ");
    const cloneStatus = project.flow.clone.exitCode == 0 ? "fa-check" : "fa-x";
    const cloneString = getLogString(project.flow.clone);
    //const buildStatus = project.flow.build.exitCode == 0 ? "fa-check" : "fa-x";
    let startLog = "";
    if (project.flow.final) {
        const finalStatus = project.flow.final.exitCode == -1 ? "fa-check" : "fa-x";
        project.flow.final.exitCode = null;
        const finalString = getLogString(project.flow.final);
        startLog = `
        <div id="final" class="log">
            <button class="collapsibleArea"><i class="fas ${finalStatus}"></i> <b>${project.config.run}</b></button>
            <div class="collapsibleContent">
                <textarea readOnly={true} rows=${finalString.split(/\r\n|\r|\n/).length}>
                    ${finalString}
                </textarea>
            </div>
        </div>
        `;
    }
    document.getElementById(insertElementTag).innerHTML = `
    <div id="projectDivs">
        <div>
            <h2 class="containerHeader">${project.name} details</h2>
        </div>
        <div>
            <p><b>Project GitHub:</b> <em><a target="_blank" href=${project.repositoryURL}> ${project.repositoryURL}</a></em></p>
        </div>
        <div class="addressDiv">
            <p><b>Project root:</b> <em><a id=${project.name} target="_blank" href=${projectURL}> ${projectURL}</a></em></p>
            <button class="copy" onClick=copyAddress("${project.name}")><i class="fas fa-copy"></i></button>
        </div>
        ${internalHostUrl}
        <div class="log">
            <p><b>Last webhook event:</b><em> ${project.lastEvent.time.string}</em></p>
            <textarea readOnly={true} rows=${eventString.split(/\r\n|\r|\n/).length}>
                ${eventString}
            </textarea>
        </div>
        <div class="log">
            <p><b>Configuration:</b></p>
            <textarea readOnly={true} rows=${configString.split(/\r\n|\r|\n/).length}>
                ${configString}
            </textarea>
        </div>
        <div id="buildLogs">
            <h3> Build logs: </h3>
            <div id="clone" class="log">
                <button class="collapsibleArea"><i class="fas ${cloneStatus}"></i> <b>Git clone</b></button>
                <div class="collapsibleContent">
                    <textarea readOnly={true} rows=${cloneString.split(/\r\n|\r|\n/).length}>
                        ${cloneString}
                    </textarea>
                </div>
            </div>
            <div id="installLogs">
            </div>
            ${startLog}
        </div>
    </div>
    `;
    spawnBuildLogs(project);
    setUpDropdowns();
}

function spawnBuildLogs(project = {}) {
    const buildLogsElem = document.getElementById("installLogs");
    if (project.flow.build) {
        project.flow.build.forEach(element => {
            let status = element.exitCode == 0 ? "fa-check" : "fa-x";
            let statusString = getLogString(element);
            buildLogsElem.innerHTML += `
            <div id="${element.command}" class="log">
                <button class="collapsibleArea"><i class="fas ${status}"></i> <b>${element.command}${element.exitCode != 0 ? ` | Code: ${element.exitCode}` : ``}</b></button>
                <div class="collapsibleContent">
                    <textarea readOnly={true} rows=${15}>
                        ${statusString}
                    </textarea>
                </div>
            </div>
            `;
        });
    }
}

function setUpDropdowns() {
    // From: https://www.w3schools.com/howto/howto_js_collapsible.asp
    const list = document.getElementsByClassName("collapsibleArea");

    for (let i = 0; i < list.length; i++) {
        list[i].addEventListener("click", function() {
            this.classList.toggle("open");
            var content = this.nextElementSibling;
            if (content.style.maxHeight){
                content.style.maxHeight = null;
            }
            else {
                content.style.maxHeight = content.scrollHeight + "px";
            } 
        });
    }
}

function getLogString(execRes) {
    let cmdFlowP = `\n:> ${execRes.command}\n`;
    execRes.output.forEach(element => {
        cmdFlowP += `\n${element}`;
    });
    cmdFlowP += `\n`;
    execRes.error.forEach(element => {
        cmdFlowP += `\n${element}`;
    });
    cmdFlowP += `\n\nExit code: ${execRes.exitCode}`;
    return cmdFlowP;
}