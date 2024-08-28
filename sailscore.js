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
    // Clear any existing errors and scores.
    clearError();
    document.getElementById("scores").innerHTML = '';

    // Parse the racer names/numbers/classes for valid entries.
    const classes = parseClasses();
    const entrants = parseEntrants(classes);
    const races = parseRaces(classes, entrants);

    // Every class gets the same number of discards.
    const discardCount = parseInt(document.getElementById('discardCount').value);

    // Score each class separately.
    for (const classInfo of classes) {
        const classResults = races[classInfo.abbrev];
        let finalScores = [];

        // We want to know how many people are in this class so we can score DNF's correctly.
        let classEntrantCount = 0;
        for (const entrant of entrants) {
            if (entrant.classes.includes(classInfo.abbrev)) {
                classEntrantCount++;
            }
        }

        for (const entrant of entrants) {
            // Skip if this entrant is not in this class.
            if (!entrant.classes.includes(classInfo.abbrev)) {
                continue;
            }

            let scores = [];
            let total = 0;
            let firstScored = parseInt(document.getElementById("firstScoredRace").selectedOptions[0].value) - 1;
            let lastScored = parseInt(document.getElementById("lastScoredRace").selectedOptions[0].value) - 1;
            for (let raceIndex = firstScored; raceIndex <= lastScored; raceIndex++) {
                let finished = false;
                for (let i = 0; i < classResults[raceIndex].length; i++) {
                    const currentFinisher = classResults[raceIndex][i];
                    if (currentFinisher.number == entrant.number && currentFinisher.name == entrant.name) {
                        scores.push(i + 1);
                        total += (i + 1);
                        finished = true;
                    }
                }
                if (!finished) {
                    if (document.getElementById('dnfCount').value.match(/finishers/)) {
                        scores.push(classResults[raceIndex].length + 1);
                        total += (classResults[raceIndex].length + 1);
                    } else {
                        scores.push(classEntrantCount + 1);
                        total += (classEntrantCount + 1);
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

        caption.innerHTML = classInfo.name;

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
        for (const entrant of finalScores) {
            let row = document.createElement("tr");

            let posCell = document.createElement("td");
            posCell.innerHTML = pos;
            row.appendChild(posCell);

            let name = document.createElement("td");
            name.className = "left";
            name.innerHTML = entrant.entrant.name;
            row.appendChild(name);

            let sail = document.createElement("td");
            sail.innerHTML = entrant.entrant.number;
            sail.className = "sailNum";
            row.appendChild(sail);

            let offset = parseInt(document.getElementById("firstScoredRace").selectedOptions[0].value) - 1;
            for (var i = 0; i < entrant.scores.length; i++) {
                let score = document.createElement("td");
                score.innerHTML = entrant.scores[i];
                if (entrant.scores[i] >= classResults[i + offset].length + 1) {
                    score.innerHTML += " (DNF)";
                }

                if (entrant.discardRaces.includes(i)) {
                    score.innerHTML = '[' + score.innerHTML + ']';
                }

                row.appendChild(score);
            }

            let total = document.createElement("td");
            total.innerHTML = entrant.total;
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

function parseRaces(classes, racers) {
    const raceResults = {};
    // Create an empty set of results for each class.
    for (const classInfo of classes) {
        raceResults[classInfo.abbrev] = [];
    }

    // Figure out how many races we'll parse, and parse each race.
    const raceCount = document.querySelectorAll("#raceEntries textarea").length;
    for (var i = 0; i < raceCount; i++) {
        // First thing for each race is to create an enmpty set of scoring data for each class in the race.
        for (const classInfo of classes) {
            raceResults[classInfo.abbrev][i] = [];
        }

        // Now let's get the actual scoring data from the doc.
        const raceText = document.getElementById("raceEntry" + (i + 1)).value;
        const lines = raceText.split(/[\r\n]/);
        
        // First, let's make sure that we don't have duplicate/ambiguous entries.
        let racersMatchingLines = {};
        const resultsAsRacerObjects = [];
        for (const line of lines) {
            // Skip empty lines
            const entry = line.trim();
            if (!entry) {
                continue;
            }

            const matchedRacers = [];
            for (const racer of racers) {
                if (racerMatches(racer, line)) {
                    matchedRacers.push(racer);
                }
            }

            // This line doesn't match any racers.
            if (matchedRacers.length == 0) {
                showError("Couldn't find a matching racer for entry '" + line + "' in race " + (i + 1));
                continue;
            }

            // This line matches too many racers.
            if (matchedRacers.length > 1) {
                const matchedRacerStrings = [];
                for (const r of matchedRacers) {
                    matchedRacerStrings.push(r.number + ' ' + r.name);
                }
                showError("In race " + (i + 1) + ", found ambiguous racer entry '" + line + "', could be: " + matchedRacerStrings.join(', '));
            }

            // Store an entry for this racer so we can see if the lines are duplicated.
            if (matchedRacers[0].number + ' ' + matchedRacers[0].name in racersMatchingLines) {
                racersMatchingLines[matchedRacers[0].number + ' ' + matchedRacers[0].name]++;
            } else {
                racersMatchingLines[matchedRacers[0].number + ' ' + matchedRacers[0].name] = 1;
            }

            // Push the racer object into our actual results.
            resultsAsRacerObjects.push(matchedRacers[0]);
        }

        // Every line now matches exactly one racer, but they're not necessarily different racers. Check this.
        for (const key in racersMatchingLines) {
            if (racersMatchingLines[key] > 1) {
                showError("In race " + (i + 1) + " there are multiple results matching entrant '" + key + "'.");
            }
        }

        // Ok, now we're happy that each row of the results matches exactly one entrant, and that now two rows match the same entrant.
        // Let's actually get on to adding the results to the appropriate classes.
        for (const resultRacer of resultsAsRacerObjects) {
            for (const racerClass of resultRacer.classes) {
                // Push this racer to the back of the results for this class, unless there's already an entry for them.
                // This only happens if the same entrant is in the reults twice, which is an error, but we still want to compute a
                // valid finishing oruder.
                let alreadyHasResult = false;
                for (existingResult of raceResults[racerClass][i]) {
                    if (existingResult.name == resultRacer.name && existingResult.number == resultRacer.number) {
                        alreadyHasResult = true;
                        break;
                    }
                }
                if (!alreadyHasResult) {
                    raceResults[racerClass][i].push(resultRacer);
                }
            }
        }
    }

    return raceResults;
}

// The format for racer names is expected to be something like:
// Number FirstName LastName ClassA ClassB ClassC
// Number is a (perhaps not unique) sail number.
// Name can have any number of words.
// The racer can be in any number of classes.
// If there is only a single class, the class abbreviation may be omitted.
function parseEntrants(classes) {
    const classAbbreviationList = [];
    for (let classInfo of classes) {
        classAbbreviationList.push(classInfo.abbrev);
    }

    const names = [];
    const lines = document.getElementById('racerNameEntry').value.split(/[\r\n]/);
    for (const line of lines) {
        const trimmedName = line.trim();
        if (!trimmedName) {
            continue;
        }

        let nameData = trimmedName.split(/\s+/);
        let racerClassList = [];
        while (classAbbreviationList.includes(nameData[nameData.length - 1])) {
            racerClassList.push(nameData.pop());
        }
        if ((classes.length == 1) && !racerClassList.length) {
            racerClassList.push(classes[0].abbrev);
        }

        if (nameData.length == 0) {
            showError("Couldn't parse racer entry" + line);
        }

        let racerNumber = nameData.shift();
        let racerName = nameData.join(' ');
        names.push({
            name: racerName,
            classes: racerClassList,
            number: racerNumber,
        })
    }
    return names;
}

// Each line here is an Abbreviation followed by a full class name. I.e.:
// MW Men's Windsurfing.
// If a single word is entered, it is used as both the abbreviation and full name.
// If there are no entries, and single class named `All` is created.
function parseClasses() {
    const lines = document.getElementById('racerClassEntry').value.split(/[\r\n]/);

    let classes = [];
    for (const line of lines) {
        const trimmedClass = line.trim();
        if (trimmedClass.match(/^\s*$/)) {
            continue;
        }
        
        let words = trimmedClass.split(/\s+/);
        let abbrev = words.shift();
        let name = words.join(' ');
        if (!words.length) {
            name = abbrev;
        }

        classes.push({
            name,
            abbrev,
        });
    }

    if (!classes.length) {
        classes.push({
            name: 'All',
            abbrev: 'All',
        });
    }

    return classes;
}

function matchPrefix(name, prefix) {
    let addSpace = prefix.match(/^[0-9]+$/) ? ' ' : '';
    return name.match(new RegExp('^' + prefix + addSpace));
}

// `racer` should be an object with the keys:
// name
// classes
// number
function racerMatches(racer, prefix) {
    // If the prefix is a number, it must match the racer number exactly.
    if (parseInt(prefix).toString() == prefix) {
        return prefix == racer.number;
    }

    // Otherwise, we match if it's the number followed by part of the name.
    return (racer.number + ' ' + racer.name).startsWith(prefix);
}

function showError(message) {
    const msg = document.createElement('div');
    msg.innerText = message;
    document.getElementById('errorMessage').appendChild(msg);
}

function clearError() {
    document.getElementById('errorMessage').innerHTML = '';
}