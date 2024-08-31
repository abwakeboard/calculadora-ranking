const pointsTable = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5];

function parseCSV(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
        const data = reader.result.split('\n').map(row => row.split(/[,;]/).map(cell => cell.trim()));
        callback(data);
    };
    reader.readAsText(file);
}

function parseCSVasync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(event) {
            const data = reader.result.split('\n').map(row => row.split(/[,;]/).map(cell => cell.trim()));
            resolve(data);
        };

        reader.onerror = function(event) {
            reject(new Error("Error reading file"));
        };

        reader.readAsText(file);
    });
}


async function calculateRanking() {
    console.log(`Calculando ranking!`);

    const affiliatedInput = document.getElementById('affiliated').files[0];
    const stage1Input = document.getElementById('stage1').files[0];
    const stage2Input = document.getElementById('stage2').files[0];
    const stage3Input = document.getElementById('stage3').files[0];
    const stage4Input = document.getElementById('stage4').files[0];

    // if (!affiliatedInput || !stage1Input || !stage2Input || !stage3Input || !stage4Input) {
    //     alert('Please upload all files.');
    //     return;
    // }

    const affiliatedData = await parseCSVasync(affiliatedInput);
    const affiliatedAthletes = new Set(affiliatedData.slice(1).map(row => row[0])); // Extracting names

    const stages = [stage1Input, stage2Input, stage3Input, stage4Input];
    let rankings = {};

    console.log(`Filiados:`, affiliatedAthletes);
    console.log(`Etapas ${stages.length}:`, stages);

    stages.forEach(async (stageFile, index) => {

        console.log(`Iniciando processamento da etapa ${index}: `, stageFile?.name);

        const stageData = await parseCSVasync(stageFile);

        stageData?.slice(1).forEach(row => {
            const division = row[0];
            const athlete = row[1];
            const place = parseInt(row[2]);

            // se o atleta não for filiado, retorna
            if (!affiliatedAthletes.has(athlete)) return;

            const points = pointsTable[place - 1] || 0;

            if (!rankings[division]) rankings[division] = {};

            if (!rankings[division][athlete]) rankings[division][athlete] = { totalPoints: 0, stages: [0,0,0,0] };

            rankings[division][athlete].stages[index] = points;
            rankings[division][athlete].totalPoints += points;

            // Handle division changes and score reduction by 70%
            if (index > 0 && rankings[division][athlete].lastDivision !== division) {
                rankings[division][athlete].totalPoints = Math.floor(rankings[division][athlete].totalPoints * 0.7);
            }
            rankings[division][athlete].lastDivision = division;
        });

        // After processing all stages, calculate final rankings
        if (index != stages.length - 1) return;
        displayRankings(rankings);

    });

}

function displayRankings(rankings) {
    console.log(`Montando tabela com dados:`, rankings);
    const output = document.getElementById('output');
    output.innerHTML = '';

    for (const division in rankings) {
        const table = document.createElement('table');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>Division</th>
            <th>Athlete</th>
            <th>Points (Stage 1)</th>
            <th>Points (Stage 2)</th>
            <th>Points (Stage 3)</th>
            <th>Points (Stage 4)</th>
            <th>Total Points</th>
        `;
        table.appendChild(headerRow);

        const sortedAthletes = Object.entries(rankings[division]).sort((a, b) => b[1].totalPoints - a[1].totalPoints);

        sortedAthletes.forEach(([athlete, data]) => {
            const row = document.createElement('tr');
            const stages = data.stages;
            let totalPoints = stages.reduce((a, b) => a + b, 0);
            const minPoints = Math.min(...stages);

            // Apply strikethrough for the lowest score if there are 4 stages
            const stageCells = stages.map(stage => {
                return stages.length > 3 && stage === minPoints ? `<td class="strikethrough">${stage}</td>` : `<td>${stage}</td>`;
            }).join('');

            row.innerHTML = `
                <td>${division}</td>
                <td>${athlete}</td>
                ${stageCells}
                <td>${totalPoints}</td>
            `;
            table.appendChild(row);
        });

        output.appendChild(table);
        output.appendChild(document.createElement('br'));
    }
}
