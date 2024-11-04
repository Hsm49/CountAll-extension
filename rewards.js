// rewards.js

const rewards = {
    high: [
        { name: 'Objeto Raro 1', probability: 0.05 },
        { name: 'Objeto Raro 2', probability: 0.03 },
        { name: 'Objeto Raro 3', probability: 0.02 }
    ],
    medium: [
        { name: 'Objeto Medio 1', probability: 0.10 },
        { name: 'Objeto Medio 2', probability: 0.07 },
        { name: 'Objeto Medio 3', probability: 0.05 }
    ],
    low: [
        { name: 'Objeto Común 1', probability: 0.20 },
        { name: 'Objeto Común 2', probability: 0.15 },
        { name: 'Objeto Común 3', probability: 0.10 }
    ]
};

export function getReward(pomodorosCompleted) {
    let rewardList = [];
    if (pomodorosCompleted >= 20) {
        rewardList = rewards.high;
    } else if (pomodorosCompleted >= 10) {
        rewardList = rewards.medium;
    } else {
        rewardList = rewards.low;
    }

    for (const reward of rewardList) {
        if (Math.random() < reward.probability) {
            return reward.name;
        }
    }

    return null; // No reward
}