const tabelaDePontos = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5];
const ordemCategorias = [
    "Adaptado",
    "Mirim",
    "Mirim Masculino",
    "Mirim Feminino",
    "Mirim Masculino ate 12 anos",
    "Mirim Masculino  ate 12 anos",
    "Mirim Feminino ate 12 anos",
    "Mirim Feminino  ate 12 anos",
    "Estreantes",
    "Estreantes Feminino",
    "Estreantes Masculino",
    "Iniciante",
    "Iniciante Masculino",
    "Iniciante Feminino",
    "Intermediario Masculino",
    "Intermediario Feminino",
    "Avancado",
    "Avancado Masculino",
    "Avancado Feminino",
    "Feminino",
    "Open",
    "Open Masculino",
    "Open Feminino",
    "Profissional",
    "Profissional Masculino",
    "Profissional Feminino",
    "PRO Event"
];

let numeroEtapas = 0;

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

// Retorna os nomes dos atletas filiados a partir da lista do TicketSports (CSV)
// ou do SporTickets (XLSX). No XLSX, somente membros com status ACTIVE são válidos.
async function parseFiliadosAsync(file) {
    const extensao = file.name.split('.').pop()?.toLowerCase();

    if (extensao !== 'xlsx') {
        const data = await parseCSVasync(file);
        return data.slice(1).map(row => row[0]);
    }

    if (typeof XLSX === 'undefined') {
        throw new Error('Não foi possível carregar o leitor de arquivos XLSX.');
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const nomeAbaMembros = workbook.SheetNames.find(nome => nome.trim().toLowerCase() === 'membros');

    if (!nomeAbaMembros) {
        throw new Error('A planilha do SporTickets não contém a aba "Membros".');
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[nomeAbaMembros], {
        header: 1,
        defval: ''
    });
    const headers = rows[0]?.map(header => String(header).trim().toLowerCase()) || [];
    const nomeIndex = headers.indexOf('nome');
    const statusIndex = headers.indexOf('status');

    if (nomeIndex === -1 || statusIndex === -1) {
        throw new Error('A aba "Membros" deve conter as colunas "Nome" e "Status".');
    }

    return rows
        .slice(1)
        .filter(row => String(row[statusIndex]).trim().toUpperCase() === 'ACTIVE')
        .map(row => row[nomeIndex]);
}

function normalizaNome(nome) {
    return String(nome || '').trim().toLowerCase();
}

function normalizaHeader(header) {
    return String(header || '')
        .replace(/^\uFEFF/, '')
        .trim()
        .replace(/^"|"$/g, '')
        .trim()
        .toLowerCase();
}

function categoriaSemRanking(categoria) {
    return String(categoria || '').trim().toLowerCase().includes('estreantes');
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

    numeroEtapas = 0;
    document.getElementById('customCss').textContent = '';

    let filiadosAtletas;

    try {
        const nomesFiliados = await parseFiliadosAsync(filiadosInput);
        filiadosAtletas = new Map();
        nomesFiliados.forEach(nome => {
            const nomeNormalizado = normalizaNome(nome);
            if (nomeNormalizado) filiadosAtletas.set(nomeNormalizado, String(nome).trim());
        });
    } catch (error) {
        console.error('Erro ao processar a lista de filiados:', error);
        alert(error.message);
        return;
    }

    const todasEtapas = [etapa1Input, etapa2Input, etapa3Input, etapa4Input]
    const etapas = todasEtapas.filter(item => item); // remove itens vazios (tipo 3 e 4 etapa, se ainda não aconteceram)
    let rankings = {}; // rankings finais
    let ultimasCategorias = {}; // ultima categoria que um atleta competiu. Vai ser utilizado pra ajudar no calculo de transferencia de nota

    console.log(`Filiados:`, filiadosAtletas);
    console.log(`Etapas ${etapas.length}:`, etapas);

    // esconde da tabela as etapas sem arquivos CSV
    todasEtapas.forEach((etapaFile, index) => { 
        if (!etapaFile) {
            console.warn(`Nenhum arquivo enviado para a etapa ${index+1}. Escondendo da tabela`);
            document.getElementById('customCss').textContent += `
                .etapa${index+1} {
                display: none;
                }
            `;
        } else {
            numeroEtapas++;
        }
    });

    for (const [index, etapaFile] of etapas.entries()) {

        console.log(`Iniciando processamento da etapa ${index}: `, etapaFile?.name);

        const etapaData = await parseCSVasync(etapaFile);
        const headers = etapaData[0] || [];
        const divisionIndex = headers.findIndex(header => normalizaHeader(header) === 'division');
        const athleteIndex = headers.findIndex(header => normalizaHeader(header) === 'athlete');
        const placeIndex = headers.findIndex(header => normalizaHeader(header) === 'place');
        const colunasAusentes = [
            ['Division', divisionIndex],
            ['Athlete', athleteIndex],
            ['Place', placeIndex]
        ].filter(([, columnIndex]) => columnIndex === -1).map(([columnName]) => columnName);

        if (colunasAusentes.length > 0) {
            alert(`O CSV da ${index + 1}ª etapa não contém as colunas obrigatórias: ${colunasAusentes.join(', ')}.`);
            return;
        }

        // reordena na ordem certa das categorias
        const etapaDataSorted = etapaData.slice(1).sort((a, b) =>
            ordemCategorias.indexOf(a[divisionIndex]) - ordemCategorias.indexOf(b[divisionIndex])
        );

        // inicia calculo específico para essa etapa
        etapaDataSorted.forEach(row => {
            const categoria = row[divisionIndex];

            // Categorias de Estreantes não participam do ranking nem de transferências.
            if (categoriaSemRanking(categoria)) return;

            const nomeAtletaCSV = row[athleteIndex];
            const nomeAtleta = filiadosAtletas.get(normalizaNome(nomeAtletaCSV));
            const colocacao = parseInt(row[placeIndex]);

            // se o atleta não for filiado, retorna
            if (!nomeAtleta) return;

            console.log(`${categoria.toLowerCase()}, ${nomeAtleta}, ${colocacao}`);

            const points = tabelaDePontos[colocacao - 1] || 0; // define quantos pontos o atleta fez nessa etapa

            // cria categoria se ela ainda não existe
            if (!rankings[categoria]) rankings[categoria] = {};

            // vamos criar o perfil do atleta na categoria atual
            // primeiro, vamos ver se ele ja esteve em alguma outra categoria
            // Se ele esteve, vamos copiar o perfil dele para a nova categoria, e tirar 30% das notas das etapas
            // A categoria Wakeskate não é considerada nesse caso
            if (ultimasCategorias[nomeAtleta] && ultimasCategorias[nomeAtleta] != categoria && categoria.toLowerCase() != "wakeskate") {
                const ultimaCateogria = ultimasCategorias[nomeAtleta];
                console.log(`${nomeAtleta} mudou de categoria na etapa ${index + 1}! De ${ultimaCateogria} para ${categoria}`);
                // copia o perfil para a nova categoria
                rankings[categoria][nomeAtleta] = JSON.parse(JSON.stringify(rankings[ultimaCateogria][nomeAtleta])); // json stringify e json parse pra criar uma cópia do atleta, e não uma referência
                // desconta 30% das notas
                rankings[categoria][nomeAtleta][`etapas`] = rankings[categoria][nomeAtleta][`etapas`].map(num => num * 0.7);
                // vamos criar uma array que contem os index das notas que transferimos. Assim podemos marcar elas com um asterisco na tabela final, para feedback
                rankings[categoria][nomeAtleta][`transferencias`] = rankings[categoria][nomeAtleta][`etapas`].map((num, index) => num !== 0 ? index : -1).filter(index => index !== -1);

                // remove o atleta da categoria anterior após a transferência
                delete rankings[ultimaCateogria][nomeAtleta];
                if (Object.keys(rankings[ultimaCateogria]).length === 0) {
                    delete rankings[ultimaCateogria];
                }

            } else if (!rankings[categoria][nomeAtleta]) { // se é a primeira etapa do atleta, criamos um perfil novo vazio
                rankings[categoria][nomeAtleta] = {
                    pontosTotal: 0,
                    etapas: [0, 0, 0, 0],
                    colocacoes: [null, null, null, null]
                };
            }

            // a array ultimasCategorias é utilizada pra conferir se o atleta mudou de categoria pra realizar o desconto de 30% da nota
            // O wakeskate deve ser desconsiderado nesse caso
            if (categoria.toLowerCase() != "wakeskate") {
                ultimasCategorias[nomeAtleta] = categoria;
            }

            // adiciona os novos pontos
            rankings[categoria][nomeAtleta].etapas[index] = points;
            rankings[categoria][nomeAtleta].colocacoes[index] = colocacao;

            const descarte = calcDescarte(rankings[categoria][nomeAtleta].etapas); // calcula a nota final com descarte, e o indice da nota descartada

            rankings[categoria][nomeAtleta].pontosTotal = descarte.soma; // soma todos os pontos
            rankings[categoria][nomeAtleta].indexDescarte = descarte.indexDescarte; // index da ntoa descartada

        });

    }

    displayRankings(rankings);
}

function colocacaoValida(colocacao) {
    return Number.isInteger(colocacao) && colocacao > 0;
}

function ultimaColocacaoValida(colocacoes) {
    for (let index = colocacoes.length - 1; index >= 0; index--) {
        if (colocacaoValida(colocacoes[index])) return colocacoes[index];
    }
    return null;
}

function comparaDesempate(atletaA, atletaB) {
    const colocacoesA = atletaA.colocacoes || [];
    const colocacoesB = atletaB.colocacoes || [];
    const todasColocacoes = [...colocacoesA, ...colocacoesB].filter(colocacaoValida);
    const maiorColocacao = todasColocacoes.length > 0 ? Math.max(...todasColocacoes) : 0;

    // Compara primeiro o número de vitórias, depois de segundos lugares e assim por diante.
    for (let colocacao = 1; colocacao <= maiorColocacao; colocacao++) {
        const quantidadeA = colocacoesA.filter(valor => valor === colocacao).length;
        const quantidadeB = colocacoesB.filter(valor => valor === colocacao).length;

        if (quantidadeA !== quantidadeB) return quantidadeB - quantidadeA;
    }

    // Persistindo o empate, compara a colocação da última participação de cada atleta.
    const ultimaParticipacaoA = ultimaColocacaoValida(colocacoesA);
    const ultimaParticipacaoB = ultimaColocacaoValida(colocacoesB);

    if (colocacaoValida(ultimaParticipacaoA) && colocacaoValida(ultimaParticipacaoB)) {
        const diferenca = ultimaParticipacaoA - ultimaParticipacaoB;
        if (diferenca !== 0) return diferenca;
    }

    // Como último critério, usa o resultado da última etapa do circuito.
    const ultimaEtapaIndex = numeroEtapas - 1;
    const ultimaColocacaoA = colocacoesA[ultimaEtapaIndex];
    const ultimaColocacaoB = colocacoesB[ultimaEtapaIndex];
    const participouA = colocacaoValida(ultimaColocacaoA);
    const participouB = colocacaoValida(ultimaColocacaoB);

    if (participouA && participouB) return ultimaColocacaoA - ultimaColocacaoB;
    if (participouA !== participouB) return participouA ? -1 : 1;
    return 0;
}

// função que renderiza o HTML da tabela
function displayRankings(rankings) {
    console.log(`Montando tabela com dados:`, rankings);
    const output = document.getElementById('output');
    output.innerHTML = '';

    nomeCircuitoOutput.innerHTML = nomeCircuito.value;

    // processa cada uma das divisões
    for (const categoria in rankings) {
        const table = document.createElement('table');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>Categoria</th>
            <th>Posição</th>
            <th>Nome</th>
            <th class='etapa1'>1ª Etapa:<br><span class='nomeEtapa'>${etapa1nome.value}</span></th>
            <th class='etapa2'>2ª Etapa:<br><span class='nomeEtapa'>${etapa2nome.value}</span></th>
            <th class='etapa3'>3ª Etapa:<br><span class='nomeEtapa'>${etapa3nome.value}</span></th>
            <th class='etapa4'>4ª Etapa:<br><span class='nomeEtapa'>${etapa4nome.value}</span></th>
            <th>Total</th>
        `;
        table.appendChild(headerRow);

        // vamos ordenar o ranking
        const atletasSorted = Object.entries(rankings[categoria]).sort((a, b) => {

            console.log(`[Ordem Ranking] COMPARANDO ${a[0]} com ${b[0]}:`, a, b);

            // Primeiro, compara o total de pontos. Quem tem mais pontos fica na frente
            const pontosDiff = b[1].pontosTotal - a[1].pontosTotal;
            if (pontosDiff !== 0) return pontosDiff;

            console.log(`[Ordem Ranking] Total de pontos igual (${a[1].pontosTotal} vs ${b[1].pontosTotal}). Aplicando os critérios de desempate por colocação.`);
            return comparaDesempate(a[1], b[1]);
        });

        console.log(`Atletas da categoria ${categoria} em ordem:`, atletasSorted);

        let posicaoAnterior = 0;
        let atletaAnterior = null;

        atletasSorted.forEach(([nomeAtleta, data], index) => {
            const empatadoComAnterior = atletaAnterior
                && data.pontosTotal === atletaAnterior.pontosTotal
                && comparaDesempate(atletaAnterior, data) === 0;
            const posicao = empatadoComAnterior ? posicaoAnterior : index + 1;
            const row = document.createElement('tr');
            const etapas = data.etapas;
            let pontosTotal = roundIfDecimal(data.pontosTotal);

            // adiciona risco a menor nota
            const etapaCells = etapas.map((etapa, index) => {
                const notaArredondada = roundIfDecimal(etapa);
                const asterisco = data.transferencias && data.transferencias.includes(index) ? `*` : ``; // adiciona asterisco se a nota foi uma trasnferência de outra categoria
                return index == data.indexDescarte ? `<td class="descarte etapa${index + 1}">${notaArredondada}${asterisco}</td>` : `<td class="etapa${index + 1}">${notaArredondada}${asterisco}</td>`;
            }).join('');

            row.innerHTML = `
                <td>${categoria}</td>
                <td>${posicao}</td>
                <td>${nomeAtleta}</td>
                ${etapaCells}
                <td>${pontosTotal}</td>
            `;
            table.appendChild(row);
            posicaoAnterior = posicao;
            atletaAnterior = data;
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
