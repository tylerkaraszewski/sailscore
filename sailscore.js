//Init
addEventListener('DOMContentLoaded', init);

function init() {
    document.getElementById('raceCount').addEventListener('change', () => {updateRaceCount(); score();}, false);
    document.getElementById('saveButton').addEventListener('click', save, false);
    document.getElementById('loadButton').addEventListener('change', load, false);
    document.getElementById('firstScoredRace').addEventListener('change', e => {checkScoredRaceRange(e); score();}, false);
    document.getElementById('lastScoredRace').addEventListener('change', e => {checkScoredRaceRange(e); score();}, false);
    document.getElementById('hideControls').addEventListener('click', toggleEntryVisibilty, false);

    // If anything else changes, re-score.
    document.getElementById('racerNameEntry').addEventListener('keyup', score, false);
    document.getElementById('racerClassEntry').addEventListener('keyup', score, false);
    document.getElementById('racerDNFAllEntry').addEventListener('keyup', score, false);
    document.getElementById('discardCount').addEventListener('change', score, false);
    document.getElementById('dnfCount').addEventListener('change', score, false);

    // Set the dropdowns for numer of races and discards.
    for (setting of [[1, 20, "raceCount"], [0, 5, "discardCount"]]) {
        for (let i = setting[0]; i <= setting[1]; i++) {
            let option = document.createElement("option");
            option.value = i;
            option.innerText = i;
            document.getElementById(setting[2]).appendChild(option);
        }
    }

    // Draw the first empty race.
    updateRaceCount();
}

function toggleEntryVisibilty(e) {
    if (e.target.checked) {
        document.getElementById('flexWrapper').style.display = 'none';
    } else {
        document.getElementById('flexWrapper').style.display = '';
    }
}

function checkScoredRaceRange(e) {
    let other = e.target.id == "firstScoredRace" ? "lastScoredRace" : "firstScoredRace";
    let otherVal = parseInt(document.getElementById(other).value);
    let myVal = parseInt(e.target.value);
    if(e.target.id == "firstScoredRace") {
        if (otherVal < myVal) {
            document.getElementById(other).value = e.target.value;
        }
    } else {
        if (otherVal > myVal) {
            document.getElementById(other).value = e.target.value;
        }
    }
}

function updateRaceCount() {
    const entries = document.getElementById('raceEntries');
    const newCount = parseInt(document.getElementById('raceCount').value);
    const existingCount = parseInt(entries.children.length);

    if (newCount < existingCount) {
        for (let i = existingCount; i > newCount; i--) {
            entries.removeChild(entries.lastElementChild);
        }
    } else if (newCount > existingCount) {
        for (let i = existingCount; i < newCount; i++) {
            let wrapper = document.createElement("div");
            let title = document.createElement("span");
            title.innerText = 'R' + (i + 1);
            const textarea = document.createElement('textarea');
            textarea.addEventListener('keyup', score, false);
            textarea.id = 'raceEntry' + (i + 1);
            wrapper.appendChild(title);
            wrapper.appendChild(document.createElement("br"));
            wrapper.appendChild(textarea);
            entries.appendChild(wrapper);
        }
    }

    // Reset the scored races to be all existing races.
    for (const id of ["firstScoredRace", "lastScoredRace"]) {
        document.getElementById(id).innerHTML = "";
        for (let i = 1; i <= newCount; i++) {
            let option = document.createElement("option");
            option.value = i;
            option.innerText = i;
            document.getElementById(id).appendChild(option);
        }
    }
    document.getElementById("lastScoredRace").selectedIndex = document.getElementById("lastScoredRace").options.length - 1;
}

function save() {
    let races = [];
    for (const race of document.querySelectorAll('#raceEntries textarea')) {
        races.push(race.value);
    }

    let scoring = {
        races,
        names: document.getElementById('racerNameEntry').value,
        classes: document.getElementById('racerClassEntry').value,
        racerDNFAllEntry: document.getElementById('racerDNFAllEntry').value,
        discards: document.getElementById('discardCount').selectedOptions[0].value,
        dnfscoring: document.getElementById('dnfCount').selectedOptions[0].value,

    };

    // The rest just gets the file to download.
    saveURL = URL.createObjectURL(new Blob([JSON.stringify(scoring)], { type: "application/json" }));
    const tempLink = document.createElement("a");
    tempLink.style.display = 'none';
    tempLink.href = saveURL;
    tempLink.download = "scoring.json";
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
    URL.revokeObjectURL(saveURL);
}

function load(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            document.getElementById('racerNameEntry').value = json.names;
            document.getElementById('racerClassEntry').value = json.classes;
            document.getElementById('racerDNFAllEntry').value = json.racerDNFAllEntry;
            document.getElementById("raceCount").value = json.races.length;
            document.getElementById("discardCount").value = json.discards;
            document.getElementById("dnfCount").value = json.dnfscoring;
            updateRaceCount();
            let i = 0;
            for (const race of document.querySelectorAll('#raceEntries textarea')) {
                race.value = json.races[i];
                i++;
            }
            score();
        } catch (error) {
            console.error("Error parsing JSON:", error);
        }
    };
    reader.readAsText(file);
}

function score() {
    clearError();
    document.getElementById("scores").innerHTML = '';

    // Parse the racer names/numbers for valid entries.
    const racerNames = parseRacerNames();
    const classes = parseClasses(racerNames);
    const races = parseRaces(classes);

    // Keep track of racers who finished no races.
    let finishedNoRaces = parseDNFAll(racerNames);

    // Do each entered class separately.
    for (const className of Object.keys(classes)) {

        // Make these easy to access.
        const classResults = races[className];
        const classEntrants = classes[className];

        // Figure out what was entered but did not compete.
        const didNotCompete = [];
        for (const entrant of classEntrants) {
            // If the racer is marked as having finished no races, we'll score themn anyway.
            if (finishedNoRaces.includes(entrant)) {
                continue;
            }

            let participated = false;
            let firstScored = parseInt(document.getElementById("firstScoredRace").selectedOptions[0].value) - 1;
            let lastScored = parseInt(document.getElementById("lastScoredRace").selectedOptions[0].value) - 1;
            for (let raceIndex = firstScored; raceIndex <= lastScored; raceIndex++) {
                for (const raceFinisher of classResults[raceIndex]) {
                    if (matchPrefix(entrant, raceFinisher)) {
                        participated = true;
                        break;
                    }
                }
            }
            if (!participated) {
                didNotCompete.push(entrant);
            }
        }

        // Check for duplicates.
        for (let i = 0; i < classResults.length; i++) {
            let duplicates = findDuplicates(classResults[i]);
            for (dupe of duplicates) {
                showError("Duplicate finisher in race " + (i + 1) + ", entrant #" + dupe);
            }
        }

        discardCount = parseInt(document.getElementById('discardCount').value);
        finalScores = [];
        for (const entrant of classEntrants) {
            // Just skip anyone who didn't race tonight.
            if (didNotCompete.includes(entrant)) {
                continue;
            }
            let scores = [];
            let total = 0;
            let firstScored = parseInt(document.getElementById("firstScoredRace").selectedOptions[0].value) - 1;
            let lastScored = parseInt(document.getElementById("lastScoredRace").selectedOptions[0].value) - 1;
            for (let raceIndex = firstScored; raceIndex <= lastScored; raceIndex++) {
                const finishersPlus1 = document.getElementById('dnfCount').value.match(/finishers/);
                let finished = false;
                for (let i = 0; i < classResults[raceIndex].length; i++) {
                    if (matchPrefix(entrant, classResults[raceIndex][i])) {
                        scores.push(i + 1);
                        total += (i + 1);
                        finished = true;
                        break;
                    }
                }
                if (!finished) {
                    if (finishersPlus1) {
                        scores.push(classResults[raceIndex].length + 1);
                        total += (classResults[raceIndex].length + 1);
                    } else {
                        scores.push(classEntrants.length + 1);
                        total += (classEntrants.length + 1);
                    }
                }
            }

            // Find discards.
            let discards = [...scores];
            let discardRaces = [];
            discards.sort(function(a, b) {return b - a});
            discards = discards.slice(0, discardCount);
            for (discard of discards) {
                for (var i = 0; i < scores.length; i++) {
                    if (scores[i] == discard && !discardRaces.includes(i)) {
                        discardRaces.push(i);
                        total -= scores[i];
                        break;
                    }
                }
            }

            finalScores.push({
                entrant,
                total,
                scores,
                discardRaces,
            });
        }

        finalScores.sort(sortScores);

        // Now we can build a table of scores.
        var table = document.createElement("table");
        var caption = document.createElement("caption");
        var header = document.createElement("thead");
        var headerRow = document.createElement("tr");
        var posHead = document.createElement("th");
        var nameHead = document.createElement("th");
        var sailHead = document.createElement("th");
        var totalHead = document.createElement("th");
        let raceHead = [];

        let firstScored = parseInt(document.getElementById("firstScoredRace").selectedOptions[0].value) - 1;
        let lastScored = parseInt(document.getElementById("lastScoredRace").selectedOptions[0].value) - 1;
        for (var i = firstScored; i <= lastScored; i++) {
            let h = document.createElement("th")
            h.innerText = "Race " + (i + 1);
            h.scope = "col";
            raceHead.push(h);
        }

        caption.innerHTML = className;

        posHead.innerHTML = "Pos"
        posHead.scope = "col";
        nameHead.innerHTML = "Name"
        nameHead.scope = "col";
        sailHead.innerHTML = "Sail #"
        sailHead.scope = "col";
        totalHead.innerHTML = "Total"
        sailHead.scope = "col";

        headerRow.appendChild(posHead);
        headerRow.appendChild(nameHead);
        headerRow.appendChild(sailHead);
        for (var i = 0; i <= lastScored - firstScored; i++) {
            headerRow.appendChild(raceHead[i]);
        }
        headerRow.appendChild(totalHead);
        header.appendChild(headerRow);
        table.appendChild(caption);
        table.appendChild(header);

        let pos = 1;
        for (const sailor of finalScores) {
            let sailNo = sailor.entrant.match(/^(\d+)\s+(.*)/);
            let sailNumber = sailNo[1];
            let sailorName = sailNo[2];

            let row = document.createElement("tr");

            let posCell = document.createElement("td");
            posCell.innerHTML = pos;
            row.appendChild(posCell);

            let name = document.createElement("td");
            name.className = "left";
            name.innerHTML = sailorName;
            row.appendChild(name);

            let sail = document.createElement("td");
            sail.innerHTML = sailNumber;
            sail.className = "sailNum";
            row.appendChild(sail);

            let offset = parseInt(document.getElementById("firstScoredRace").selectedOptions[0].value) - 1;
            for (var i = 0; i < sailor.scores.length; i++) {
                let score = document.createElement("td");
                score.innerHTML = sailor.scores[i];
                if (sailor.scores[i] >= classResults[i + offset].length + 1) {
                    score.innerHTML += " (DNF)";
                }

                if (sailor.discardRaces.includes(i)) {
                    score.innerHTML = '[' + score.innerHTML + ']';
                }

                row.appendChild(score);
            }

            let total = document.createElement("td");
            total.innerHTML = sailor.total;
            row.appendChild(total);

            table.appendChild(row);
            pos++;
        }

        document.getElementById("scores").appendChild(table);
    }
}

function sortScores(a, b) {
    if (a.total != b.total) {
        return a.total - b.total;
    }

    // Appendix A.8.1 tiebreaker.
    let aSorted = [...a.scores];
    let bSorted = [...b.scores];
    aSorted.sort(function(a, b) {return b - a}).reverse();
    bSorted.sort(function(a, b) {return b - a}).reverse();
    for (var i = 0; i < aSorted.length; i++) {
        if (aSorted[i] != bSorted[i]) {
            return aSorted[i] - bSorted[i];
        }
    }

    // Appendix A.8.2 tiebreaker.
    for (var i = a.scores.length - 1; i >= 0; i--) {
        return a.scores[i] - b.scores[i];
    }

    showError("Boats " + a.entrant + " and " + b.entrant + " are tied after A.8.2 tiebreaker. Is that even possible?");
}

function parseRaces(classes) {
    const raceResults = {};
    for (const key in classes) {
        raceResults[key] = [];
    }

    const raceCount = document.querySelectorAll("#raceEntries textarea").length;
    for (var i = 0; i < raceCount; i++) {
        for (const key in classes) {
            raceResults[key][i] = [];
        }

        const raceText = document.getElementById("raceEntry" + (i + 1)).value;
        const lines = raceText.split(/[\r\n]/);
        for (const line of lines) {
            if (line.match(/^\s*$/)) {
                // skip empty lines.
                continue;
            }

            let found = false;
            const entry = line.trim();

            let matchCount = 0;
            let lastMatchedName = '';
            for (const key of Object.keys(classes)) {
                for (const racer of classes[key]) {
                    if (matchPrefix(racer, entry)) {
                        if (matchCount) {
                            showError('Race ' +  (i + 1) + ' found duplicate matches for "' + entry + '": "' + lastMatchedName + '" and "' + racer + '".');
                        }
                        matchCount++;
                        lastMatchedName = racer;
                    }
                }
                if (matchCount) {
                    raceResults[key][i].push(entry);
                    found = true;
                    break;
                }
            }
            if (!found) {
                showError("Found no class for racer: " + entry + " (race " + (i + 1) + ")");
            }
        }
    }

    return raceResults;
}

function parseRacerNames() {
    const names = [];
    const lines = document.getElementById('racerNameEntry').value.split(/[\r\n]/);
    for (const line of lines) {
        if (names.includes(line.trim())) {
            showError("Duplicate racer: " + line.trim());
        }
        if (line.trim() != '') {
            names.push(line.trim());
        }
    }
    return names;
}

function parseClasses(racerNames) {
    let racerNamesCopy = [...racerNames];
    classObject = {};
    let wildcard = '';
    let classes = document.getElementById('racerClassEntry').value;

    if (classes.match(/^\s*$/s)) {
        classes = "All *";
    }

    const lines = classes.split(/[\r\n]/);
    for (const line of lines) {
        if (line.match(/^\s*$/)) {
            // skip empty lines.
            continue;
        }
        
        let items = line.split(/\s+/);
        const className = items[0];
        items.shift();
        items = items.filter(item => item !== '');

        classObject[className] = [];

        if (!items.length) {
            showError("Class with no entries: " + className);
        }

        for (const entry of items) {
            if (entry == '*') {
                // This one is special, save for last.
                wildcard = className;
                break;
            }

            let matchCount = 0;
            let lastMatchedName = '';
            for (racer of racerNamesCopy) {
                if (matchPrefix(racer, entry)) {
                    if (matchCount) {
                        showError('Class "' + className + '" found duplicate entries for "' + entry + '": "' + lastMatchedName + '" and "' + racer + '".');
                    }
                    matchCount++;
                    lastMatchedName = racer;
                }
            }
            if (matchCount) {
                // We found someone matching this name, add them to the class list.
                classObject[className].push(lastMatchedName);

                // Remove them from the list, they're no longer in consideration.
                const index = racerNamesCopy.indexOf(lastMatchedName);
                racerNamesCopy.splice(index, 1);

            }
        }
    }
    if (wildcard !== '') {
        // Now we append whatever's left.
        for (const racer of racerNamesCopy) {
            classObject[wildcard].push(racer);
        }
    }

    if (!Object.keys(classObject).length) {
        showError("No classes defined.");
    }

    return classObject;
}

function matchPrefix(name, prefix) {
    let addSpace = prefix.match(/^[0-9]+$/) ? ' ' : '';
    return name.match(new RegExp('^' + prefix + addSpace));
}

function parseDNFAll(racerNames) {
    let dnf = document.getElementById('racerDNFAllEntry').value;
    const dnfList = [];

    const lines = dnf.split(/[\r\n]/);
    for (const line of lines) {
        let trimmed = line.trim();
        if (trimmed != '') {
            let matchCount = 0;
            let lastMatchedName = '';
            for (const racer of racerNames) {
                if (matchPrefix(racer, trimmed)) {
                    if (matchCount) {
                        showError('DNF All Races entry "' + trimmed + '" is ambiguous, could be "' + racer + '" or "' + lastMatchedName + '".');
                    }
                    matchCount++;
                    lastMatchedName = racer;
                }
            }
            if (!matchCount) {
                showError('DNF All Races entry "' + trimmed + '" matched no racers.');
            }
            dnfList.push(lastMatchedName);
        }
    }

    return dnfList;
}

function showError(message) {
    const msg = document.createElement('div');
    msg.innerText = message;
    document.getElementById('errorMessage').appendChild(msg);
}

function clearError() {
    document.getElementById('errorMessage').innerHTML = '';
}

// chatgpt helped me:
function findDuplicates(array) {
  let duplicates = [];
  let seen = new Set();

  array.forEach(item => {
    if (seen.has(item)) {
      if (!duplicates.includes(item)) {
        duplicates.push(item);
      }
    } else {
      seen.add(item);
    }
  });

  return duplicates;
}
