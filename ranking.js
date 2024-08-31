const tabelaDePontos = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5];
const ordemCategorias = ["Adaptado", "Mirim Masculino", "Mirim Feminino", "Estreantes", "Iniciante Masculino", "Iniciante Feminino", "Intermediario", "Avancado", "Feminino", "Open", "Profissional", "PRO Event"];

// função que retorna um array com os dados de um CSV
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

// funcção principal para calcular o ranking
async function calculateRanking() {
    console.log(`Calculando ranking!`);

    const filiadosInput = document.getElementById('filiados').files[0];
    const etapa1Input = document.getElementById('etapa1').files[0];
    const etapa2Input = document.getElementById('etapa2').files[0];
    const etapa3Input = document.getElementById('etapa3').files[0];
    const etapa4Input = document.getElementById('etapa4').files[0];

    if (!filiadosInput || !etapa1Input) {
        alert('Por favor insira pelo menos a lista de filiados e a 1ª etapa');
        return;
    }

    const filiadosData = await parseCSVasync(filiadosInput);
    const filiadosAtletas = new Set(filiadosData.slice(1).map(row => row[0])); // pega os nomes dos atletas filiados

    const etapas = [etapa1Input, etapa2Input, etapa3Input, etapa4Input].filter(item => item); // remove itens vazios (tipo 3 e 4 etapa, se ainda não aconteceram)
    let rankings = {}; // rankings finais
    let ultimasCategorias = {}; // ultima categoria que um atleta competiu. Vai ser utilizado pra ajudar no calculo de transferencia de nota

    console.log(`Filiados:`, filiadosAtletas);
    console.log(`Etapas ${etapas.length}:`, etapas);

    etapas.forEach(async (etapaFile, index) => {

        // se estamos na ultima etapa, mas nenhum arquivo foi providenciado para essa etapa, inicia a renderização da tabela
        if (!etapaFile && index == etapas.length - 1) {
            displayRankings(rankings);
            return;
        };

        console.log(`Iniciando processamento da etapa ${index}: `, etapaFile?.name);

        const etapaData = await parseCSVasync(etapaFile);

        // reordena na ordem certa das categorias
        const etapaDataSorted = etapaData.slice(1).sort((a, b) => 
            ordemCategorias.indexOf(a[0]) - ordemCategorias.indexOf(b[0])
        );

        // inicia calculo específico para essa etapa
        etapaDataSorted.forEach(row => {
            const categoria = row[0];
            const nomeAtleta = row[1];
            const colocacao = parseInt(row[2]);

            // se o atleta não for filiado, retorna
            if (!filiadosAtletas.has(nomeAtleta)) return;

            const points = tabelaDePontos[colocacao - 1] || 0; // define quantos pontos o atleta fez nessa etapa

            // cria categoria se ela ainda não existe
            if (!rankings[categoria]) rankings[categoria] = {};

            // vamos criar o perfil do atleta na categoria atual
            // primeiro, vamos ver se ele ja esteve em alguma outra categoria
            // Se ele esteve, vamos copiar o perfil dele para a nova categoria, e tirar 30% das notas das etapas
            if(ultimasCategorias[nomeAtleta] && ultimasCategorias[nomeAtleta] != categoria) {
                const ultimaCateogria = ultimasCategorias[nomeAtleta];
                console.log(`${nomeAtleta} mudou de categoria na etapa ${index + 1}! De ${ultimaCateogria} para ${categoria}`);
                // copia o perfil para a nova categoria
                rankings[categoria][nomeAtleta] = JSON.parse(JSON.stringify(rankings[ultimaCateogria][nomeAtleta])); // json stringify e json parse pra criar uma cópia do atleta, e não uma referência
                // desconta 30% das notas
                rankings[categoria][nomeAtleta][`etapas`] = rankings[categoria][nomeAtleta][`etapas`].map(num => num * 0.7);
                // vamos criar uma array que contem os index das notas que transferimos. Assim podemos marcar elas com um asterisco na tabela final, para feedback
                rankings[categoria][nomeAtleta][`transferencias`] = rankings[categoria][nomeAtleta][`etapas`].map((num, index) => num !== 0 ? index : -1).filter(index => index !== -1);

            } else if (!rankings[categoria][nomeAtleta]) { // se é a primeira etapa do atleta, criamos um perfil novo vazio
                rankings[categoria][nomeAtleta] = { pontosTotal: 0, etapas: [0, 0, 0, 0] };
            }

            ultimasCategorias[nomeAtleta] = categoria;

            // adiciona os novos pontos
            rankings[categoria][nomeAtleta].etapas[index] = points;

            const descarte = calcDescarte(rankings[categoria][nomeAtleta].etapas); // calcula a nota final com descarte, e o indice da nota descartada

            rankings[categoria][nomeAtleta].pontosTotal = descarte.soma; // soma todos os pontos
            rankings[categoria][nomeAtleta].indexDescarte = descarte.indexDescarte; // index da ntoa descartada

        });

        // se estamos na ultima etapa, vamos começar a calcular o ranking
        if (index != etapas.length - 1) return;
        displayRankings(rankings);

    });
}

// função que renderiza o HTML da tabela
function displayRankings(rankings) {
    console.log(`Montando tabela com dados:`, rankings);
    const output = document.getElementById('output');
    output.innerHTML = '';

    // adiciona título
    const titulo = document.createElement('h1');
    titulo.innerHTML = nomeCircuito.value;
    output.appendChild(titulo);

    // processa cada uma das divisões
    for (const categoria in rankings) {
        const table = document.createElement('table');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>Categoria</th>
            <th>Nome</th>
            <th>1ª Etapa:<br><span class='nomeEtapa'>${etapa1nome.value}</span></th>
            <th>2ª Etapa:<br><span class='nomeEtapa'>${etapa2nome.value}</span></th>
            <th>3ª Etapa:<br><span class='nomeEtapa'>${etapa3nome.value}</span></th>
            <th>4ª Etapa:<br><span class='nomeEtapa'>${etapa4nome.value}</span></th>
            <th>Total</th>
        `;
        table.appendChild(headerRow);

        // vamos ordenar o ranking
        const atletasSorted = Object.entries(rankings[categoria]).sort((a, b) => {
            // Primeiro, compara o total de pontos. Quem tem mais pontos fica na frente
            const pontosDiff = b[1].pontosTotal - a[1].pontosTotal;
            if (pontosDiff !== 0) return pontosDiff;
        
            // se empatar pelo total de pontos, vamos comparar os valores individuais de cada etapa.
            // o atleta que tiver uma pontuação maior em uma única etapa fica na frente

            // Vamos ordenar o valor das etapas em ordem descrescente:
            const etapasA = [...a[1].etapas].sort((x, y) => y - x);
            const etapasB = [...b[1].etapas].sort((x, y) => y - x);
        
            // agora vamos comparar os valores individuais de cada uma das etapas.
            for (let i = 0; i < etapasA.length; i++) {
                const diff = etapasB[i] - etapasA[i];
                if (diff !== 0) return diff; // Se um valor for maior do que o outro, retorna isso como a ordem final
            }
        
            // Se todos os valores forem iguais, mantém a ordem. Em teoria isso é impossível, mas vai que né.
            return 0;
        });

        console.log(`Atletas da categoria ${categoria} em ordem:`, atletasSorted);

        atletasSorted.forEach(([nomeAtleta, data]) => {
            const row = document.createElement('tr');
            const etapas = data.etapas;
            let pontosTotal = roundIfDecimal(data.pontosTotal);

            // adiciona risco a menor nota
            const etapaCells = etapas.map((etapa, index) => {
                const notaArredondada = roundIfDecimal(etapa);
                const asterisco = data.transferencias && data.transferencias.includes(index) ? `*` : ``; // adiciona asterisco se a nota foi uma trasnferência de outra categoria
                return index == data.indexDescarte ? `<td class="strikethrough">${notaArredondada}${asterisco}</td>` : `<td>${notaArredondada}${asterisco}</td>`;
            }).join('');

            row.innerHTML = `
                <td>${categoria}</td>
                <td>${nomeAtleta}</td>
                ${etapaCells}
                <td>${pontosTotal}</td>
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