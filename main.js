// Auto-expanding textarea
function autoExpandTextarea() {
    let textarea = document.querySelector('textarea');

    textarea.addEventListener('input', function() {
        this.style.height = 'auto'; // Reset height to auto
        this.style.height = this.scrollHeight + 'px'; // Set the new height based on content
    });
}

// Execute auto-expand function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    autoExpandTextarea();
});

function generateLink() {
    const textarea = document.querySelector('textarea');
    const noteInput = document.querySelector('#noteInput');
    const content = document.querySelector('textarea').value;
    const note = noteInput.value;
    const formattedContent = content.replace(/ /g, '&nbsp;').split('\n').join('<br>');
    console.log("generateLink function called");

    fetch('/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: formattedContent })
    })
    .then(response => response.json())
    .then(data => {
        // Append link to history
        const linkList = document.querySelector('.link-list');
        const listItem = document.createElement('li');

        const link = document.createElement('a');
        link.href = data.link;
        link.innerText = `ChatPad ${linkList.children.length + 1}`;
        link.target = "_blank";
        listItem.appendChild(link);

        const noteSpan = document.createElement('span');
        noteSpan.innerText = note;
        listItem.appendChild(noteSpan);

        const timestamp = new Date().toLocaleTimeString();
        const timeSpan = document.createElement('span');
        timeSpan.innerText = timestamp;
        listItem.appendChild(timeSpan);

        const expiresInSpan = document.createElement('span');
        expiresInSpan.innerText = "10:00"; // Start with 10 minutes
        listItem.appendChild(expiresInSpan);

        const extendButton = document.createElement('button');
        extendButton.innerText = "Extend";
        extendButton.classList.add('lock-in-button');
        extendButton.addEventListener('click', function() {
            extendDocument(data.link.split('/view/')[1], expiresInSpan, extendButton);
            
            // Start the cooldown after clicking
            extendButton.disabled = true;
            extendButton.style.cursor = "not-allowed"; // Set the cursor style
            let cooldownSeconds = 10;
            const cooldownInterval = setInterval(() => {
                extendButton.innerText = `Wait ${cooldownSeconds}s`;
                cooldownSeconds--;
                if (cooldownSeconds < 0) {
                    clearInterval(cooldownInterval);
                    extendButton.innerText = "Extend";
                    extendButton.disabled = false;
                    extendButton.style.cursor = "pointer"; // Reset the cursor style
                }
            }, 1000);
        });

        listItem.appendChild(extendButton);

        linkList.appendChild(listItem);

        startCountdown(expiresInSpan, extendButton, 20); // Set to 600 for 10 mins

        // Save to localStorage after generating the link
        saveLinkToLocalStorage({
            href: data.link,
            note: note,
            timestamp: timestamp,
            expiresIn: "10:00", // Start with 10 minutes
            id: uniqueID
        });

        // Clear note input after appending
        noteInput.value = '';
    });
}

function saveLinkToLocalStorage(linkData) {
    let links = JSON.parse(localStorage.getItem('links')) || [];
    links.push(linkData);
    localStorage.setItem('links', JSON.stringify(links));
}

function extendDocument(id, expiresInSpan, extendButton) {
    fetch(`/extend/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if(response.status === 404) {
            throw new Error('Link Expired');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Convert remaining seconds to HH:MM:SS format
            const hours = Math.floor(data.remainingSeconds / 3600);
            const minutes = Math.floor((data.remainingSeconds % 3600) / 60);
            const seconds = data.remainingSeconds % 60;

            expiresInSpan.innerText = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            // Here, you'll want to clear the previous countdown associated with this entry
            const uniqueID = id; // Assuming `id` is unique for each entry
            if (countdownIntervals[uniqueID]) {
                clearInterval(countdownIntervals[uniqueID]);
            }
            // Then, restart the countdown for this entry
            startCountdown(expiresInSpan, extendButton, data.remainingSeconds || 20); // Set to 600 for 10 mins

            // Disable extendButton for 10 seconds
            let cooldownSeconds = 10;
            extendButton.disabled = true;
            extendButton.innerText = `Extend (${cooldownSeconds}s)`;
            const cooldownInterval = setInterval(() => {
                cooldownSeconds--;
                extendButton.innerText = `Extend (${cooldownSeconds}s)`;
                if (cooldownSeconds <= 0) {
                    clearInterval(cooldownInterval);
                    if(expiresInSpan.innerText !== 'Expired') {
                        extendButton.disabled = false;
                        extendButton.innerText = "Extend";
                    }
                    }
            }, 1000);
        }
    });
}

function getUniqueIDForElement(element) {
    let uniqueID = element.getAttribute('data-id');
    if (!uniqueID) {
        uniqueID = Date.now().toString();
        element.setAttribute('data-id', uniqueID);
    }
    return uniqueID;
}

let countdownIntervals = {}; // Use this to store multiple countdown intervals

function startCountdown(spanElement, extendButton, initialSeconds) {
    let totalSeconds = initialSeconds || 20; // Set to 600 for 10 mins
    
    const uniqueID = getUniqueIDForElement(spanElement.closest('li'));

    
    // Clear any existing countdown for this specific span
    if (countdownIntervals[uniqueID]) {
        clearInterval(countdownIntervals[uniqueID]);
    }

    countdownIntervals[uniqueID] = setInterval(() => {
        totalSeconds--;

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        spanElement.innerText = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (totalSeconds <= 0) {
            clearInterval(countdownIntervals[uniqueID]); // Clear this interval
            spanElement.innerText = 'Expired';
            spanElement.classList.add('expired');
    
            extendButton.disabled = true;
            extendButton.innerText = "Expired"; // Set button text to "Expired"
            extendButton.classList.add('disabled');
    
            // Update the link to point to expired.html
            const listItem = spanElement.closest('li');
            const linkElement = listItem.querySelector('a');
            linkElement.href = '/expired.html';
    
            // Move the parent list item (li) of this span to the bottom of the list
            listItem.parentElement.appendChild(listItem);

            const id = spanElement.closest('li').querySelector('a').href.split('/view/')[1];
            updateLinkInLocalStorage(id, { expiresIn: 'Expired' });
        }
        
        else {
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            const timeString = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            const id = spanElement.closest('li').querySelector('a').href.split('/view/')[1];
            updateLinkInLocalStorage(id, { expiresIn: timeString });
        }
        
    }, 1000);
}

function appendLinkToList(linkData) {
    const linkList = document.querySelector('.link-list');
    const listItem = document.createElement('li');

    const link = document.createElement('a');
    link.href = linkData.href;
    link.innerText = `ChatPad ${linkList.children.length + 1}`;
    link.target = "_blank";
    listItem.appendChild(link);

    const noteSpan = document.createElement('span');
    noteSpan.innerText = linkData.note;
    listItem.appendChild(noteSpan);

    const timeSpan = document.createElement('span');
    timeSpan.innerText = linkData.timestamp;
    listItem.appendChild(timeSpan);

    const expiresInSpan = document.createElement('span');
    expiresInSpan.innerText = linkData.expiresIn;
    listItem.appendChild(expiresInSpan);

    const extendButton = document.createElement('button');
    extendButton.innerText = "Extend";
    extendButton.classList.add('lock-in-button');
    extendButton.addEventListener('click', function() {
        const id = linkData.href.split('/view/')[1];
        extendDocument(id, expiresInSpan, extendButton);
        // The cooldown logic remains the same as you've already implemented.
    });

    listItem.appendChild(extendButton);

    linkList.appendChild(listItem);

    startCountdown(expiresInSpan, extendButton, 20); // Adjust the time as required.
}

function updateLinkInLocalStorage(id, updatedData) {
    let links = JSON.parse(localStorage.getItem('links')) || [];
    let linkIndex = links.findIndex(link => link.href.includes(id));
    if (linkIndex !== -1) {
        Object.assign(links[linkIndex], updatedData);
        localStorage.setItem('links', JSON.stringify(links));
    }
}

// Attach event to the button
document.querySelector('#generateBtn').addEventListener('click', generateLink);

document.addEventListener('DOMContentLoaded', function() {
    autoExpandTextarea();

    // Load links from localStorage
    let links = JSON.parse(localStorage.getItem('links')) || [];
    links.forEach(linkData => {
        appendLinkToList(linkData);
    });
});

