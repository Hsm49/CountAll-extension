export function calculateSessionPoints(session) {
    const pointsPer25Min = 5;
    const sessionPoints = (session.session_duration / 25) * pointsPer25Min;
    return sessionPoints;
}

export function savePoints(points) {
    chrome.storage.local.get(['totalPoints'], (result) => {
        const totalPoints = result.totalPoints || 0;
        chrome.storage.local.set({ totalPoints: totalPoints + points });
    });
}

export function loadPoints(callback) {
    chrome.storage.local.get(['totalPoints'], (result) => {
        const totalPoints = result.totalPoints || 0;
        callback(totalPoints);
    });
}