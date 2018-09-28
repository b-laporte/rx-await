import { cancel } from "../../operators/cancel";
import { task } from '../../core/tasks';
import { debounceTime } from '../../operators/debounceTime';
import { cancelAll } from '../../operators/cancelAll';
import { fromEvent } from '../../sources/fromEvent';
import { lock } from '../../operators/lock';
import { delay } from '../../operators/delay';

const ESCAPE = "Escape";

let inputField = document.getElementById("inputField"),
    suggestionsList = document.getElementById("suggestions");

addEventListener("load", () => {
    initTypeAhead(inputField);
})

function initTypeAhead(inputField) {
    let needInfoTip = true, tipShowing = false;

    fromEvent(inputField, "keydown").forEach(async ($$, event: KeyboardEvent) => {
        lock($$); // cancel future tasks as long as the task that created the lock is not completed
        let mainTask = task($$),
            searchTerm = "";

        fromEvent($$, inputField, 'blur').forEach(async ($$, e: KeyboardEvent) => {
            cancel($$, mainTask, "blur");
        });

        mainTask.onCompletion(() => hideResults(true));

        await fromEvent($$, inputField, 'keyup').forEach(async ($$, e: KeyboardEvent) => {
            // cancel processing if escape is pressed
            if (e.key === ESCAPE) {
                cancel($$, mainTask, "escape");
            }

            await debounceTime($$, 300); // interrupt through exceptions or return value?
            let v = inputField.value;
            if (v.length <= 2) {
                if (!tipShowing) {
                    hideResults(true);
                }
                cancelAll($$, "notEnoughChars", false); // cancel all other running instances as input changed
                if (needInfoTip) {
                    await debounceTime($$, 600);
                    displayInfoTip();
                    tipShowing = true;
                    needInfoTip = false;
                }
            } else if (v !== searchTerm) {
                searchTerm = v;
                hideResults();
                tipShowing = false;
                cancelAll($$, "deprecatedRequest", false); // cancel all other tasks except the current one

                // call server
                //let results = await doAndRetry($$, 2, async ($$) => {
                setProcessing(true);
                let results = await fetchResults($$, searchTerm);
                setProcessing(false);

                displayResults(results, searchTerm);
            }
        });
    });
}

function setProcessing(active: boolean) {
    inputField!.style.color = active ? "orange" : "";
}

async function fetchResults($$, searchTerm: string) {
    await delay($$, random(100, 400)); // network delay

    let results: string[] = [], nbr = random(0, 10);
    for (let i = 0; nbr > i; i++) {
        results.push(searchTerm + " #" + (i + 1));
    }
    return results;
}

function hideResults(hideProcessing = false) {
    if (hideProcessing) {
        setProcessing(false);
    }
    suggestionsList!.style.visibility = "hidden";
}

function displayInfoTip() {
    suggestionsList!.innerHTML = `<li><i>Please enter at least 3 characters...</i></li>`;
    suggestionsList!.style.visibility = "visible";
}

function displayResults(results: string[], searchTerm: string) {
    let h: string[] = [];
    if (results.length === 0) {
        h.push(`<li> No results for <i>${searchTerm}</i> ... </li>`);
    } else {
        for (let i = 0; results.length > i; i++) {
            h.push(`<li> ${results[i]} </li>`);
        }
    }

    suggestionsList!.innerHTML = h.join("");
    suggestionsList!.style.visibility = "visible";
}

function random(min: number, max: number) {
    return min + Math.floor(Math.random() * (Math.abs(max - min) + 1));
}
