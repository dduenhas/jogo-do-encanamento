# Jogo do Encanamento

Um quebra-cabeça de canos para a sala de aula. A água nasce em **S**, o aluno monta o caminho e ela precisa chegar ao ralo **R**. Da terceira fase em diante, a cisterna **C** também precisa encher. Qualquer ponta aberta vaza.

O jogo segue a gramática do *Pipe Mania*: uma fila de peças, rotação antes de colocar, colocação livre no tabuleiro e um fluido que percorre o que foi construído. São três estilos — vidro, bambu e futurista — com dez fases cada. Não há conta, ranking online nem arquivos de áudio: o som é sintetizado no navegador e o progresso fica no próprio aparelho.

Para jogar, abra o site. Para rodar na máquina, sirva a pasta (um `index.html` aberto direto também funciona):

```bash
python -m http.server 8765
```

As regras do tabuleiro podem ser conferidas sem navegador:

```bash
node test/engine.test.js
node test/levelgen.test.js
```

## Como se joga

A peça da frente da fila é a próxima. Ela gira e entra em qualquer casa vazia. Durante o preparo a água ainda não corre. No modo automático, ela sai sozinha quando o tempo acaba; soltá-la antes, pelo registro do tabuleiro ou pela tecla R, vale um bônus. No modo manual, o cronômetro não dispara o fluxo: a água só anda quando o aluno aciona o registro.

Cada peça tem uma função e não enfeita o tabuleiro:

- a reta segue;
- a curva muda de direção;
- a junção T divide o fluxo, um braço segue ao ralo e o outro alimenta a cisterna;
- a cruz atravessa dois caminhos e só funciona com os quatro braços ligados;
- o tanque substitui uma reta, enche devagar e vale mais pontos.

Uma boca sem par é derrota. A água então toma o tabuleiro inteiro, para o erro ficar visível. Se o fluido para sem alcançar todos os destinos, a fase também se perde. Vencer exige que S alcance cada destino sem vazamento. Uma estrela basta para concluir; a segunda pede soltar a água cedo, no modo automático; a terceira pede fazer isso sem descartar nem substituir peça.

O medidor à esquerda muda a velocidade do fluido na hora. Para cima, a água corre mais; para baixo, dá mais tempo de ler o caminho.

## Fundamentação pedagógica

### Lógica da proposta

O encanamento organiza um problema de conexões: a água parte de S e deve alcançar os destinos R e C, conforme o objetivo de cada fase. As peças definem os caminhos e as operações permitidas. A regra cabe em uma frase. A dificuldade está na combinação.

A fila limita as escolhas: o aluno trabalha com a peça disponível e precisa ajustar o plano ao que chega. A solução de referência apresenta um caminho possível, mas não precisa ser o único. Outros percursos também valem, desde que cumpram os objetivos da fase e conduzam a água sem vazamentos.

O preparo separa o planejamento da execução. Substituir um cano seco custa pontos, mas permite revisar o projeto antes da passagem da água. Quando o fluxo começa, as conexões são postas à prova: o acerto aparece na continuidade do percurso; o erro, no vazamento e no alagamento.

A progressão das fases introduz novos recursos quando os anteriores já não bastam: primeiro, as curvas e o ralo; depois, a conexão em T, com a chegada da cisterna; em seguida, a cruz, quando os percursos precisam se atravessar. O tanque acrescenta uma possibilidade de pontuação, sem substituir o objetivo principal.

### Escolhas estéticas

**Vidro.** O cano é janela: água azul-cobalto, anel cromado e registro circular. O funcionamento fica à vista.

**Bambu.** O cano evoca um material vivo: seiva, sisal, folha e uma alavanca de galho. A condução do fluxo ganha uma linguagem orgânica.

**Futurista.** Plasma e botoneira neon. O futuro, aqui, não é uma cidade: é um material que brilha quando a conexão está correta.

Nos três temas, o interior do canal permanece visível. A parede emoldura o fluxo, sem encobri-lo. O tabuleiro escuro destaca a água. Ao final, a tela de resultado espera o preenchimento dos canos, para que o aluno observe o percurso que construiu.

### Princípios de projeto

A proposta privilegia uma regra curta, estável e visível. Ela pode ser apresentada em um cartaz: a água sai de S e deve alcançar os destinos da fase, sem deixar pontas abertas no percurso conectado à fonte.

O erro faz parte da experiência. Substituir um cano seco é permitido e tem um custo na pontuação. Quando há vazamento, o alagamento e o som descendente sinalizam a falha antes da tela de resultado. A intenção é tornar a consequência perceptível, para que o aluno possa relacioná-la às próprias escolhas.

No modo automático, o início do fluxo estabelece um prazo para o planejamento. No manual, o aluno decide quando abrir o registro. A velocidade não deve ser confundida com aprendizagem: o interesse pedagógico está nas decisões, nas previsões e nas revisões que o aluno consegue explicar.

A proposta prevê o uso sem cadastro e sem servidor de partidas. Assim, a atividade pode ocorrer sem exigir que o aluno informe seu nome.

### Relação com a BNCC e seu complemento de Computação

A proposta pode contribuir para as competências gerais 2 e 5 da BNCC. A competência 2 se relaciona à investigação, à elaboração e ao teste de hipóteses e à resolução de problemas. A competência 5 envolve o uso crítico, significativo, reflexivo e ético das tecnologias digitais, com protagonismo e autoria. No jogo, o percurso construído pode ser tratado como uma hipótese, e a passagem da água, como um teste de suas conexões. Essa relação ganha sentido pedagógico quando o aluno antecipa resultados, explica decisões e revê a solução.

O complemento de Computação à BNCC, fundamentado no Parecer CNE/CEB nº 2/2022 e instituído pela Resolução CNE/CEB nº 1, de 4 de outubro de 2022, organiza as aprendizagens em três eixos: Pensamento Computacional, Mundo Digital e Cultura Digital. A proposta se aproxima principalmente do primeiro, com possibilidades de articulação com Cultura Digital. Não se pressupõe que o jogo, isoladamente, contemple os três eixos.

Nos anos iniciais, podem ser exploradas as seguintes relações:

**EF15CO01 — Organização e representação da informação.** O tabuleiro pode ser explorado como matriz, e a fila de peças, como lista ordenada. A relação com registros pode ser trabalhada por meio de descrições das peças, com atributos como tipo, orientação e posição. O foco está em o aluno reconhecer e utilizar essas formas de representação.

**EF15CO02 — Construção e simulação de algoritmos.** O professor pode propor que os alunos descrevam, por palavras, desenhos ou comandos, uma sequência de ações para construir ou verificar um percurso. Para ampliar o trabalho com a habilidade, a atividade deve incluir condições e repetições, além de sequências simples.

**EF15CO04 — Decomposição.** O desafio pode ser dividido em partes: planejar o caminho até o ralo, planejar a ligação com a cisterna e, depois, combinar as soluções. A aprendizagem está na divisão do problema, na resolução das partes e na verificação de sua integração.

**EF01CO02 — Identificação e execução de sequências de passos.** Em desafios adequados ao 1º ano, o aluno pode seguir uma sequência curta de posicionamentos e giros, observando o resultado. Quando a atividade envolver criar ou reorganizar essas instruções e reconhecer seu caráter de algoritmo, também poderá se relacionar à EF01CO03.

**EF15CO08 — Uso de tecnologias computacionais.** O jogo pode funcionar como recurso para resolver problemas e expressar soluções de maneira criativa. A mediação docente deve dar espaço à comparação de percursos, à explicação das escolhas e à reflexão sobre o uso da ferramenta.

Nos anos finais, o jogo pode servir como ponto de partida para atividades complementares:

**EF69CO04 — Decomposição e programação.** Os alunos podem dividir o desafio em subproblemas e, posteriormente, automatizar uma solução ou um procedimento de verificação em uma linguagem de programação. A montagem dos canos, sozinha, não contempla a exigência de automatização.

**EF69CO05 — Entradas, saídas e tipos de dados.** A turma pode identificar quais informações definem o problema: dimensões do tabuleiro, posições dos elementos, tipos e orientações das peças e destinos exigidos. A saída esperada pode ser uma configuração válida de conexões. O trabalho deve explicitar os tipos de dados envolvidos, sem confundir as entradas e saídas computacionais com a origem e os destinos da água.

**EF69CO06 — Generalização.** Diferentes fases podem ser comparadas como instâncias de um mesmo problema. Para desenvolver a habilidade, essa comparação deve avançar para a criação de um algoritmo geral, com parâmetros que permitam tratar diferentes configurações. A simples passagem de uma fase para outra não basta.

### Observação da aprendizagem

A estrela registra o desempenho em uma partida; sozinha, não demonstra aprendizagem. A observação do professor pode considerar se o aluno:

- antecipa uma abertura que poderá provocar vazamento;
- explica por que escolheu determinada peça ou orientação;
- divide o desafio em partes e consegue reuni-las;
- identifica a causa de uma falha e propõe uma correção;
- compara soluções e justifica suas diferenças;
- reaproveita uma estratégia em outro desafio, reconhecendo o que precisa mudar.

O foco não está apenas em fazer a água chegar. Está em compreender e explicar por que ela chega — ou por que vaza.

## Preparado para a Vercel

O projeto é estático. Não há instalador, não há empacotador e não há etapa de build. A Vercel publica a raiz do repositório. O arquivo `vercel.json` deixa isso explícito: framework nenhum, comando de build vazio, pasta de saída na raiz.

Na Vercel:

1. **Add New… → Project** e importe `dduenhas/jogo-do-encanamento`.
2. Framework Preset: **Other**.
3. Build Command vazio. Output Directory: `.` ou vazio, conforme o painel oferecer a raiz.
4. Deploy.

O endereço gerado abre direto no `index.html`. Não é preciso variável de ambiente.

## Código

HTML, CSS e JavaScript sem dependências. Cada arquivo em `js/` é um módulo imediato pendurado em `window.PM`: peças, configuração, gerador de fases, fluido, desenho, regras, entrada, interface e o laço principal. `test/` carrega só o necessário no Node e confere colocação, vazamento, vitória nas trinta fases e a validade dos mapas gerados.

A fonte permanece na primeira linha, abrindo para o sul. As fases são determinísticas a partir do estilo e do número: o mesmo aluno, no mesmo aparelho ou em outro, encontra o mesmo mapa.
