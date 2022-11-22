function copyAddress(elementID) {
    var address = document.getElementById(elementID).innerText.toString().trim();
    navigator.clipboard.writeText(address);
} 

function displayProjectsList(projects = [], insertElementTag, domain) {
    console.log(projects);
    projects.forEach(element => {
        console.log("hee hee");
        document.getElementById(insertElementTag).innerHTML += `
            <div>
                <div class="projectDivs">
                    <div>
                        <h2 class="projectTitle">${element.name}</h2>
                    </div>
                    <div>
                        <p><b>Project GitHub:</b> <em><a target="_blank" href=${element.repositoryURL}>${element.repositoryURL}</a></em></p>
                    </div>
                    <div class="addressDiv">
                        <p><b>Project root:</b> <em><a id="${element.name}" target="_blank" href="${domain + "/" + element.name + "/"}"> ${domain + "/" + element.name + "/"}</a></em></p>
                        <button class="copy" onClick="copy(${domain + "/" + element.name + "/"})"><i class="fas fa-copy"></i></button>
                    </div>
                    <div class="addressDiv">
                        <p><b>Project details:</b> <em><a id="${element.name+"dat"}" target="_blank" href="${domain + "/boop/projects/" + element.name + "/"}"> ${domain + "/boop/projects/" + element.name + "/"}</a></em></p>
                        <button class="copy" onClick="copy(${domain + "/" + element.name + "/"})"><i class="fas fa-copy"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
}