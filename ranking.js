const pointsTable = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5];
const ordemCategorias = ["Adaptado", "Mirim Masculino", "Mirim Feminino", "Estreantes", "Iniciante Masculino", "Iniciante Feminino", "Intermediario", "Avancado", "Feminino", "Open", "Profissional", "PRO Event"];

function parseCSVasync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (event) {
            const data = reader.result.split('\n').map(row => row.split(/[,;]/).map(cell => cell.trim()));
            resolve(data);
        };

        reader.onerror = function (event) {
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

    if (!affiliatedInput || !stage1Input) {
        alert('Por favor insira pelo menos a lista de filiados e a 1ª etapa');
        return;
    }

    const affiliatedData = await parseCSVasync(affiliatedInput);
    const affiliatedAthletes = new Set(affiliatedData.slice(1).map(row => row[0])); // Extracting names

    const stages = [stage1Input, stage2Input, stage3Input, stage4Input].filter(item => item); // remove itens vazios (tipo 3 e 4 etapa, se ainda não aconteceram)
    let rankings = {}; // rankings finais
    let ultimasCategorias = {}; // ultima categoria que um atleta competiu. Vai ser utilizado pra ajudar no calculo de transferencia de nota

    console.log(`Filiados:`, affiliatedAthletes);
    console.log(`Etapas ${stages.length}:`, stages);

    stages.forEach(async (stageFile, index) => {

        // se estamos na ultima etapa, mas nenhum arquivo foi providenciado para essa etapa, inicia a renderização da tabela
        if (!stageFile && index == stages.length - 1) {
            displayRankings(rankings);
            return;
        };

        console.log(`Iniciando processamento da etapa ${index}: `, stageFile?.name);

        const stageData = await parseCSVasync(stageFile);

        // reordena na ordem certa das categorias
        const stageDataSorted = stageData.slice(1).sort((a, b) => 
            ordemCategorias.indexOf(a[0]) - ordemCategorias.indexOf(b[0])
        );

        stageDataSorted.forEach(row => {
            const division = row[0];
            const athlete = row[1];
            const place = parseInt(row[2]);

            // se o atleta não for filiado, retorna
            if (!affiliatedAthletes.has(athlete)) return;

            const points = pointsTable[place - 1] || 0;

            // cria categoria se ela ainda não existe
            if (!rankings[division]) rankings[division] = {};

            // vamos criar o perfil do atleta na categoria atual
            // primeiro, vamos ver se ele ja esteve em alguma outra categoria
            // Se ele esteve, vamos copiar o perfil dele para a nova categoria, e tirar 30% das notas das etapas
            if(ultimasCategorias[athlete] && ultimasCategorias[athlete] != division) {
                const ultimaCateogria = ultimasCategorias[athlete];
                console.log(`${athlete} mudou de categoria na etapa ${index + 1}! De ${ultimaCateogria} para ${division}`);
                // copia o perfil para a nova categoria
                rankings[division][athlete] = JSON.parse(JSON.stringify(rankings[ultimaCateogria][athlete])); // json stringify e json parse pra criar uma cópia do atleta, e não uma referência
                // desconta 30% das notas
                rankings[division][athlete][`stages`] = rankings[division][athlete][`stages`].map(num => num * 0.7);
                // vamos criar uma array que contem os index das notas que transferimos. Assim podemos marcar elas com um asterisco na tabela final, para feedback
                rankings[division][athlete][`transferencias`] = rankings[division][athlete][`stages`].map((num, index) => num !== 0 ? index : -1).filter(index => index !== -1);

            } else if (!rankings[division][athlete]) { // se é a primeira etapa do atleta, criamos um perfil novo vazio
                rankings[division][athlete] = { totalPoints: 0, stages: [0, 0, 0, 0] };
            }

            ultimasCategorias[athlete] = division;

            // adiciona os novos pontos
            rankings[division][athlete].stages[index] = points;

            const descarte = calcDescarte(rankings[division][athlete].stages); // calcula a nota final com descarte, e o indice da nota descartada

            rankings[division][athlete].totalPoints = descarte.soma; // soma todos os pontos
            rankings[division][athlete].indexDescarte = descarte.indexDescarte; // index da ntoa descartada

        });

        // se estamos na ultima etapa, vamos começar a calcular o ranking
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

        console.log(`sortedAthletes`, sortedAthletes);

        sortedAthletes.forEach(([athlete, data]) => {
            const row = document.createElement('tr');
            const stages = data.stages;
            let totalPoints = roundIfDecimal(data.totalPoints);

            // adiciona risco a menor nota
            const stageCells = stages.map((stage, index) => {
                const notaRound = roundIfDecimal(stage);
                const asterisco = data.transferencias && data.transferencias.includes(index) ? `*` : ``; // adiciona asterisco se a nota foi uma trasnferência de outra categoria
                return index == data.indexDescarte ? `<td class="strikethrough">${notaRound}${asterisco}</td>` : `<td>${notaRound}${asterisco}</td>`;
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

// calcula descarte de nota
// retorna somatória dos 3 maiores números de uma array
// retorna o index do menor numero (o descarte)
function calcDescarte(arr) {
    if (arr.length < 3) {
        throw new Error("Array must contain at least 3 elements.");
    }

    // Find the sum of the 3 biggest numbers
    const sortedArr = arr.slice().sort((a, b) => b - a);
    const soma = sortedArr[0] + sortedArr[1] + sortedArr[2];

    // Find the index of the smallest number
    const indexDescarte = arr.indexOf(Math.min(...arr));

    return {
        soma,
        indexDescarte
    };
}

// arredonda numero somente se possui valor decimal
function roundIfDecimal(num) {
    return Math.round(num * 100) / 100;
}