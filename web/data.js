// Dados embutidos: planilha de preços + histórico de clientes.
// Espelha data/precos_planilha.json e data/historico_clientes.json.

window.FLYING_PRECOS = {
  // ============== IMAGENS ==============
  externas: {
    _default: 1900,
    _descricao_padrao: "Perspectiva Externa",
    tabela: [
      { chave: "fotomontagem_drone_flying", descricao: "Fotomontagem c/ FotoDrone (Drone por conta da Flying)", preco: 4500, padroes: ["fotomontagem.*drone", "drone.*fotomontagem"] },
      { chave: "fachada_fotomontagem_voo", descricao: "Perspectiva Fachada / Fotomontagem / Voo", preco: 3000, padroes: ["\\bfachada\\b", "voo de passaro", "bird'?s view", "fotomontagem"] },
      { chave: "fotografia_aerea_drone", descricao: "Fotografia aérea Drone p/ Fotomontagem", preco: 2200, padroes: ["fotografia aerea"] },
      { chave: "estudo_fachada_cromatico", descricao: "Estudo de Fachada / Cromática", preco: 18000, padroes: ["estudo.*fachada", "estudo cromatic"] },
      { chave: "externa_diversa", descricao: "Perspectiva Externa", preco: 1900, padroes: [".*"] },
    ],
  },
  internas: {
    _default: 1750,
    _descricao_padrao: "Perspectiva Interna",
    tabela: [{ chave: "interna_diversa", descricao: "Perspectiva Interna", preco: 1750, padroes: [".*"] }],
  },
  plantas: {
    _default: 1200,
    _descricao_padrao: "Planta Humanizada",
    tabela: [
      { chave: "planta_implantacao", descricao: "Planta Humanizada Implantação / Pavimento (Térreo, Rooftop, Estac., Bolotário, Lazer)", preco: 3000, padroes: ["implantacao", "terreo", "rooftop", "mezanino", "lazer", "subsolo", "estacionamento", "bolotario", "pavimento.*completo"] },
      { chave: "planta_isometrica", descricao: "Planta Tipo Isométrica / 3D", preco: 1500, padroes: ["isometric", "3d", "mosca"] },
      { chave: "planta_tipo", descricao: "Planta Humanizada Tipo", preco: 1200, padroes: [".*"] },
    ],
  },

  // ============== TOUR VIRTUAL / VISITA VIRTUAL WEB ==============
  // Cada "ambiente" é uma sub-seção da proposta com 3 itens padrão.
  tour_virtual: {
    _titulo_secao: "VISITA VIRTUAL WEB – MULTIPLATAFORMA",
    _itens_padrao: [
      "Elaboração 3d (Arquitetura / Decoração)",
      "Render 360° VR",
      "Versão Mobile Offline – Panos 360º",
    ],
    ambientes: [
      { chave: "areas_lazer", rotulo: "ÁREAS DE LAZER", preco: 27000,
        padroes: ["areas? de lazer", "lazer comum", "area.*lazer", "espaco.*lazer"] },
      { chave: "apto_1_dorm", rotulo: "APARTAMENTO 1 DORM", preco: 10000,
        padroes: ["apto.*1.*dorm", "apartamento 1.*dorm", "1 dorm", "studio", "stúdio"] },
      { chave: "apto_2_dorms", rotulo: "APARTAMENTO 2 DORMS", preco: 12500,
        padroes: ["apto.*2.*dorm", "apartamento 2.*dorm", "2 dorm"] },
      { chave: "apto_3_dorms", rotulo: "APARTAMENTO 3 DORMS", preco: 14500,
        padroes: ["apto.*3.*dorm", "apartamento 3.*dorm", "3 dorm"] },
      { chave: "apto_4_dorms", rotulo: "APARTAMENTO 4 DORMS", preco: 16500,
        padroes: ["apto.*4.*dorm", "apartamento 4.*dorm", "4 dorm"] },
      { chave: "garden", rotulo: "GARDEN / DUPLEX", preco: 14500,
        padroes: ["\\bgarden\\b", "duplex", "cobertura"] },
      { chave: "outro", rotulo: "AMBIENTE EXTRA", preco: 10000,
        padroes: [".*"] },
    ],
    // Custos unitários da planilha (caso queira tabela detalhada)
    componentes: {
      elaboracao_ambiente:  { descricao: "Tour Virtual / VR 360 - Elaboração por ambiente", preco: 2500 },
      render_ambiente:      { descricao: "Tour Virtual / VR 360 - Render por ambiente", preco: 1200 },
      web_mobile_ambiente:  { descricao: "Tour Virtual / VR 360 - Web/Mobile/PC por ambiente", preco: 450 },
    },
  },

  // ============== MAQUETE ELETRÔNICA ==============
  maquete_eletronica: {
    chave: "maquete_eletronica",
    rotulo: "MAQUETE ELETRÔNICA",
    preco: 18000,
    itens: [
      "Produção e modelagem 3d (Arquitetura / Decoração / Paisagismo / Urbanismo)",
      "Render 360°",
      "Versão Offline",
      "Insolação",
    ],
    padroes: ["maquete eletronica", "maquete digital", "maquete 3d"],
  },

  // ============== FILMES ==============
  filmes: {
    _titulo_secao: "FILMES E ANIMAÇÕES",
    catalogo: [
      { chave: "filme_produto_90s", rotulo: "FILME PRODUTO – ATÉ 1:30 MIN", preco: 10000,
        itens: ["Estrutura: Localização, Conceito e Produto", "Roteiro Cliente ou Flying", "Edição e Composição", "Trilha sonora + locução (se necessário)", "Banco de imagens de humanização e respiros"],
        padroes: ["filme.*produto.*1[:.]?30", "filme.*produto.*90", "filme.*produto.*1\\s*minuto.*meio", "filme.*produto(?!.*takes)(?!.*10)"] },
      { chave: "filme_produto_10takes", rotulo: "FILME PRODUTO – ATÉ 10 TAKES", preco: 21000,
        itens: ["10 Takes de 6\u201D à 7\u201D segundos cada + Edição"],
        padroes: ["filme.*produto.*10.*takes", "10.*takes.*produto"] },
      { chave: "filme_conceito_150s", rotulo: "FILME CONCEITO – ATÉ 2:30 MIN", preco: 14000,
        itens: ["Estrutura: Localização, Conceito e Produto", "Roteiro Cliente ou Flying", "Edição e Composição", "Trilha sonora + locução"],
        padroes: ["filme.*conceito.*2[:.]?30", "filme.*conceito"] },
      { chave: "filme_viral_60s", rotulo: "FILME VIRAL – ATÉ 1:00 MIN", preco: 3900,
        itens: ["Estrutura: Localização, Conceito e Produto", "Edição e Composição", "Trilha sonora", "Banco de imagens"],
        padroes: ["filme.*viral.*(?:1[:.]?00|60s|1 min)", "filme.*viral(?!.*45)"] },
      { chave: "filme_viral_45s", rotulo: "FILME VIRAL – ATÉ 0:45", preco: 3900,
        itens: ["Estrutura: Localização, Conceito e Produto", "Edição e Composição", "Trilha sonora", "Banco de imagens"],
        padroes: ["filme.*viral.*(?:0[:.]?45|45s|45 seg)"] },
      { chave: "filme_institucional", rotulo: "FILME INSTITUCIONAL – ATÉ 3:30 MIN", preco: 18000,
        itens: ["Estrutura: Localização, Conceito e Produto", "Roteiro Cliente ou Flying", "Edição e Composição", "Trilha sonora + locução"],
        padroes: ["filme.*institucional"] },
      { chave: "filme_doc", rotulo: "FILME DOC – ATÉ 1:00 / EPISÓDIO", preco: 5900,
        itens: ["Documentário do empreendimento por episódio (1 minuto cada)"],
        padroes: ["filme.*doc(?:umentar)?", "documentar"] },
      { chave: "filme_3d_60s", rotulo: "FILME 3D ANIMADO – 60 SEGUNDOS", preco: 18000,
        itens: ["Animação 3D completa", "Edição e composição", "Trilha sonora"],
        padroes: ["filme.*3d.*(?:60s|60 seg|60s|1 min)", "filme.*3d(?!.*30)"] },
      { chave: "filme_3d_30s", rotulo: "FILME 3D ANIMADO – 30 SEGUNDOS", preco: 8000,
        itens: ["Animação 3D", "Edição e composição"],
        padroes: ["filme.*3d.*(?:30s|30 seg)"] },
      { chave: "takes_3d_9s", rotulo: "TAKES 3D ANIMADOS – ATÉ 9 SEG", preco: 1300,
        itens: ["Take animado 3D para redes sociais e mobile (9 segundos)"],
        padroes: ["takes? 3d", "takes? animados? 3d"] },
      { chave: "takes_ia_12s", rotulo: "TAKES I.A ANIMADOS – ATÉ 12 SEG", preco: 650,
        itens: ["Take animado em I.A para redes sociais e mobile (12 segundos)"],
        padroes: ["takes? i\\.?a", "takes? ia", "takes? em ia"] },
      { chave: "takes_7s", rotulo: "TAKES DE 7 SEGUNDOS", preco: 1300,
        itens: ["Take de 7 segundos para redes sociais"],
        padroes: ["takes? 7", "takes? de 7"] },
      { chave: "pacote_rinno", rotulo: "PACOTE RINNO FILMES", preco: 28000,
        itens: ["Filme Conceito", "Filme Produto", "2 Filmes Virais", "Takes Animados em I.A das áreas de lazer"],
        padroes: ["pacote.*rinno", "rinno.*pacote", "pacote.*completo.*filme"] },
    ],
  },

  // ============== APPS / D.BRAVE / TOUCH ==============
  apps: {
    _titulo_secao: "APLICAÇÕES E EXPERIÊNCIAS DIGITAIS",
    catalogo: [
      { chave: "dbrave", rotulo: "DESENVOLVIMENTO D.BRAVE", preco: 39000,
        itens: [
          "Catálogo Digital Interativo, permitindo ao usuário uma experiência ao interagir na tela touch screen",
          "Apresentação Completa do Empreendimento",
          "Informações Institucional",
          "Implantação",
          "Perspectivas / Imagens",
          "Localização Empreendimento",
          "Vídeo – Descanso de tela",
          "Filme Conceito",
        ],
        padroes: ["d\\.?brave", "explorador d\\.?brave", "explorador dbrave"] },
      { chave: "app_web_touch", rotulo: "DESENVOLVIMENTO APLICAÇÃO WEB – PARA TELA TOUCH", preco: 22800,
        itens: [
          "Aplicação web responsiva para tela touch screen do estande de vendas",
          "Layout customizado de acordo com identidade do empreendimento",
          "Integração com material gráfico do produto",
        ],
        padroes: ["aplica[cç][aã]o web.*touch", "app web touch", "d\\.?brave.*touch", "explorador.*touch"] },
    ],
  },

  // ============== DRONE ==============
  drone: {
    _titulo_secao: "DRONE / FOTOGRAFIA AÉREA",
    catalogo: [
      { chave: "fotografia_aerea_drone", rotulo: "Fotografia aérea Drone p/ Fotomontagem", preco: 2200,
        padroes: ["fotografia a[eé]rea", "foto a[eé]rea"] },
      { chave: "voo_drone_hora", rotulo: "Voo de Drone (por hora / endereço SP)", preco: 1800,
        padroes: ["voo.*drone", "drone.*hora"] },
    ],
  },

  // ============== ESTUDO DE FACHADA ==============
  estudo_fachada: {
    chave: "estudo_fachada",
    rotulo: "ESTUDO DE FACHADA / CROMÁTICA",
    preco: 18000,
    itens: ["Estudo de fachada e cromática completo do empreendimento"],
    padroes: ["estudo.*fachada", "estudo cromatic", "cromatic.*fachada"],
  },

  // ============== FORMA DE PAGAMENTO + PRAZOS ==============
  forma_pagamento_padrao: [
    { percentual: 50, marco: "Na aprovação desta Proposta" },
    { percentual: 25, marco: "Envio dos Shades" },
    { percentual: 25, marco: "Envio HR - Imagens finais" },
  ],
  prazos_padrao: {
    shades: "20 (Vinte) dias",
    primeiro_tiro: "15 (Quinze) dias após a aprovação dos Shades",
    revisoes: "10 (Dez) dias para contemplar e enviar novos tiros",
  },
};

// ============== HISTÓRICO ==============
window.FLYING_HISTORICO = {
  GALLI: {
    nome_padrao: "GALLI",
    contato_padrao: "DANIEL PUCCI",
    propostas: [
      {
        ref: "SAID AIACH",
        data: "2026-05-19",
        desconto_pct: 12,
        desconto_label: "12% de Desconto de Parceria",
        forma_pagamento: [
          { percentual: 50, marco: "Na aprovação desta Proposta" },
          { percentual: 25, marco: "Envio dos Shades" },
          { percentual: 25, marco: "Envio HR - Imagens finais" },
        ],
        prazos: { shades: "20 (Vinte) dias", primeiro_tiro: "15 (Quinze) dias após a aprovação dos Shades", revisoes: "10 (Dez) dias para contemplar e enviar novos tiros" },
        externas: { qtd: 9, total: 19300, itens: [
          { desc: "Perspectiva Fachada vista da calçada", preco: 3000 },
          { desc: "Perspectiva Jardim", preco: 1900 },
          { desc: "Perspectiva Quadra de areia", preco: 1900 },
          { desc: "Perspectiva Piscina", preco: 1900 },
          { desc: "Perspectiva Dec c Jacuzzi", preco: 1900 },
          { desc: "Perspectiva Playground", preco: 1900 },
          { desc: "Perspectiva Gourmet/churrasqueira", preco: 1900 },
          { desc: "Perspectiva Terraço rooftop", preco: 1900 },
          { desc: "Perspectiva Fachada Bird's View", preco: 3000 },
        ]},
        internas: { qtd: 5, total: 8750, itens: [
          { desc: "Perspectiva Bicicletário", preco: 1750 },
          { desc: "Perspectiva Academia", preco: 1750 },
          { desc: "Perspectiva Sauna", preco: 1750 },
          { desc: "Perspectiva Brinquedoteca", preco: 1750 },
          { desc: "Perspectiva Salão de Festas", preco: 1750 },
        ]},
        plantas: { qtd: 4, total: 10200, itens: [
          { desc: "Planta Humanizada Implantação Térreo", preco: 3000 },
          { desc: "Planta Humanizada Implantação Mezanino lazer", preco: 3000 },
          { desc: "Planta Humanizada Implantação rooftop", preco: 3000 },
          { desc: "Planta Humanizada Apartamento Tipo", preco: 1200 },
        ]},
      },
    ],
  },
  "CASA VIVA": {
    nome_padrao: "CASA VIVA",
    contato_padrao: "ANA BEATRIZ",
    propostas: [{
      ref: "PRESTES MAIA",
      data: "2026-05-15",
      desconto_pct: 22,
      desconto_label: "Desconto especial de 22%",
      forma_pagamento: [
        { percentual: 50, marco: "Na aprovação desta Proposta" },
        { percentual: 25, marco: "Envio dos Shades" },
        { percentual: 25, marco: "Envio HR - Imagens finais" },
      ],
      prazos: { shades: "15 (Quinze) dias", primeiro_tiro: "10 (Dez) dias após a aprovação dos Shades", revisoes: "10 (Dez) dias para contemplar e enviar novos tiros" },
      externas: { qtd: 8, total: 15800, itens: [
        { desc: "Perspectiva Fachada", preco: 2500 },
        { desc: "Perspectiva Portaria", preco: 1900 },
        { desc: "Perspectiva PetPlace", preco: 1900 },
        { desc: "Perspectiva Churrasqueira", preco: 1900 },
        { desc: "Perspectiva Horta/Pomar", preco: 1900 },
        { desc: "Perspectiva Redário", preco: 1900 },
        { desc: "Perspectiva Fitness Externo", preco: 1900 },
        { desc: "Perspectiva Bicicletário", preco: 1900 },
      ]},
      internas: { qtd: 8, total: 14000, itens: [
        { desc: "Perspectiva Lobby", preco: 1750 },
        { desc: "Perspectiva Mini Market", preco: 1750 },
        { desc: "Perspectiva Lavanderia", preco: 1750 },
        { desc: "Perspectiva Espaço Camarote", preco: 1750 },
        { desc: "Perspectiva Maleiro", preco: 1750 },
        { desc: "Perspectiva Coworking", preco: 1750 },
        { desc: "Perspectiva Espaço Beauty", preco: 1750 },
        { desc: "Perspectiva Academia", preco: 1750 },
      ]},
      plantas: { qtd: 5, total: 8300, itens: [
        { desc: "Planta Humanizada Implantação térreo", preco: 3000 },
        { desc: "Planta tipo a - 30m² - 1 dorm com varanda", preco: 1325 },
        { desc: "Planta tipo b - 24m² - 1 dorm sem varanda", preco: 1325 },
        { desc: "Planta tipo c - 37,5m² - 2 dorm com varanda", preco: 1325 },
        { desc: "Planta tipo d - 27,5m² - 1 dorm com office", preco: 1325 },
      ]},
    }],
  },
  HABRAS: {
    nome_padrao: "HABRAS",
    contato_padrao: "BEATRIZ FREIRE",
    propostas: [{
      ref: "ITAQUÁ JAPONÊS",
      data: "2026-05-20",
      desconto_pct: 10,
      desconto_label: "10% de Desconto",
      forma_pagamento: [
        { percentual: 50, marco: "Na aprovação desta Proposta" },
        { percentual: 25, marco: "Envio dos Shades" },
        { percentual: 25, marco: "Envio HR - Imagens finais" },
      ],
      prazos: { shades: "20 (Vinte) dias", primeiro_tiro: "15 (Quinze) dias após a aprovação dos Shades", revisoes: "10 (Dez) dias para contemplar e enviar novos tiros" },
      externas: { qtd: 8, total: 18500, itens: [
        { desc: "Perspectiva Fachada", preco: 3000 },
        { desc: "Perspectiva Fotomontagem", preco: 3000 },
        { desc: "Perspectiva Voo de pássaro", preco: 3000 },
        { desc: "Perspectiva Portaria", preco: 1900 },
        { desc: "Perspectiva Playground", preco: 1900 },
        { desc: "Perspectiva Piscinas", preco: 1900 },
        { desc: "Perspectiva Solarium", preco: 1900 },
        { desc: "Perspectiva Quadra", preco: 1900 },
      ]},
      internas: { qtd: 12, total: 21000, itens: [
        { desc: "Perspectiva Salão de Festas", preco: 1750 },
        { desc: "Perspectiva Cinema", preco: 1750 },
        { desc: "Perspectiva Fitness", preco: 1750 },
        { desc: "Perspectiva Salão de Jogos", preco: 1750 },
        { desc: "Perspectiva Brinquedoteca", preco: 1750 },
        { desc: "Perspectiva Coworking", preco: 1750 },
        { desc: "Perspectiva Churrasqueiras", preco: 1750 },
        { desc: "Perspectiva Pet Place", preco: 1750 },
        { desc: "Perspectiva Espaço Zen", preco: 1750 },
        { desc: "Perspectiva Lazer Coberto", preco: 1750 },
        { desc: "Perspectiva Sala", preco: 1750 },
        { desc: "Perspectiva Terraço", preco: 1750 },
      ]},
      plantas: { qtd: 8, total: 11400, itens: [
        { desc: "Planta Humanizada Implantação Geral (térreo)", preco: 3000 },
        { desc: "Planta Humanizada Tipo A Garden", preco: 1200 },
        { desc: "Planta Humanizada Tipo B", preco: 1200 },
        { desc: "Planta Humanizada Tipo C", preco: 1200 },
        { desc: "Planta Humanizada Tipo D", preco: 1200 },
        { desc: "Planta Humanizada Tipo E", preco: 1200 },
        { desc: "Planta Humanizada Tipo F", preco: 1200 },
        { desc: "Planta Humanizada Tipo G", preco: 1200 },
      ]},
    }],
  },
  BRNPAR: {
    nome_padrao: "BRNPAR",
    contato_padrao: "MARCELLE HASHIMOTO",
    propostas: [{
      ref: "NC AVARÉ",
      data: "2026-05-18",
      desconto_pct: 8,
      desconto_label: "8% de desconto",
      forma_pagamento: [
        { percentual: 30, marco: "Na aprovação desta Proposta" },
        { percentual: 20, marco: "Envio dos Shades" },
        { percentual: 50, marco: "Envio HR - Imagens finais" },
      ],
      prazos: { shades: "20 (Vinte) dias úteis", primeiro_tiro: "15 (Quinze) dias úteis após a aprovação dos Shades", revisoes: "10 (Dez) dias úteis para contemplar e enviar novos tiros" },
      externas: { qtd: 5, total: 13000, itens: [
        { desc: "Perspectiva Fotomontagem (Diurna)", preco: 3500 },
        { desc: "Perspectiva Fachada (Entardecer)", preco: 3500 },
        { desc: "Perspectiva Portaria (Entardecer)", preco: 2000 },
        { desc: "Perspectiva Playground (Diurna)", preco: 2000 },
        { desc: "Perspectiva Quadra (Diurna)", preco: 2000 },
      ]},
      internas: { qtd: 6, total: 10800, itens: [
        { desc: "Perspectiva Salão de festas (Diurna)", preco: 1800 },
        { desc: "Perspectiva Espaço Pet (Diurna)", preco: 1800 },
        { desc: "Perspectiva Quarto Casal (Diurna)", preco: 1800 },
        { desc: "Perspectiva Quarto Solteiro (Diurna)", preco: 1800 },
        { desc: "Perspectiva Living (Diurna)", preco: 1800 },
        { desc: "Perspectiva Banho (Diurna)", preco: 1800 },
      ]},
      plantas: { qtd: 3, total: 5400, itens: [
        { desc: "Planta Humanizada Implantação", preco: 3000 },
        { desc: "Planta tipo Humanizada", preco: 1200 },
        { desc: "Planta Mosca Pavimento Completo", preco: 1200 },
      ]},
    }],
  },
  OXE: {
    nome_padrao: "OXE",
    contato_padrao: "RICHARD",
    propostas: [{
      ref: "JD. SÃO PAULO",
      data: "2026-04-09",
      tipo_proposta: "tecnologias",
      tour_virtual: [
        { ambiente: "areas_lazer", preco: 27000 },
        { ambiente: "apto_1_dorm", preco: 10000 },
        { ambiente: "apto_2_dorms", preco: 12500 },
      ],
      maquete_eletronica: { preco: 18000 },
    }],
  },
};
