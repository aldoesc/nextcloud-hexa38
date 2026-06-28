const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, ExternalHyperlink,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, PageBreak, TabStopType, TabStopPosition } = require("docx");

// Colors
const PRIMARY = "1B5E8C";
const SECONDARY = "2E86C1";
const ACCENT = "E8F4FD";
const DARK = "2C3E50";
const LIGHT_GRAY = "F5F5F5";
const MID_GRAY = "CCCCCC";
const CODE_BG = "F0F0F0";

// Borders
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: MID_GRAY };
const tableBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

// Numbering config
const numberingConfig = {
  config: [
    {
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: "bullets2",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: "bullets3",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: "bullets4",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: "bullets5",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: "bullets6",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: "bullets7",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: "bullets8",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: "bullets9",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: "bullets10",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: "phases",
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
  ]
};

// Helper functions
function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, font: "Arial", color: PRIMARY })]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 26, font: "Arial", color: SECONDARY })]
  });
}

function heading3(text) {
  return new Paragraph({
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 22, font: "Arial", color: DARK })]
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, size: 22, font: "Arial", color: DARK, ...opts })]
  });
}

function boldPara(boldText, normalText) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: boldText, bold: true, size: 22, font: "Arial", color: DARK }),
      new TextRun({ text: normalText, size: 22, font: "Arial", color: DARK }),
    ]
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: "Arial", color: DARK })]
  });
}

function bulletBold(boldText, normalText, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60 },
    children: [
      new TextRun({ text: boldText, bold: true, size: 22, font: "Arial", color: DARK }),
      new TextRun({ text: normalText, size: 22, font: "Arial", color: DARK }),
    ]
  });
}

function codeBlock(lines) {
  return lines.map(line => new Paragraph({
    spacing: { after: 0 },
    shading: { fill: CODE_BG, type: ShadingType.CLEAR },
    indent: { left: 360 },
    children: [new TextRun({ text: line, size: 18, font: "Consolas", color: DARK })]
  }));
}

function spacer() {
  return new Paragraph({ spacing: { after: 80 }, children: [] });
}

function makeRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map((text, i) => new TableCell({
      borders: tableBorders,
      width: { size: cells.length === 2 ? (i === 0 ? 3500 : 5860) : (i === 0 ? 2800 : (cells.length === 3 ? 3280 : 2340)), type: WidthType.DXA },
      shading: { fill: isHeader ? PRIMARY : (cells._rowIdx % 2 === 0 ? "FFFFFF" : LIGHT_GRAY), type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({
        children: [new TextRun({
          text: String(text),
          bold: isHeader,
          size: isHeader ? 20 : 20,
          font: "Arial",
          color: isHeader ? "FFFFFF" : DARK
        })]
      })]
    }))
  });
}

function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        children: headers.map((h, i) => new TableCell({
          borders: tableBorders,
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { fill: PRIMARY, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, font: "Arial", color: "FFFFFF" })] })]
        }))
      }),
      ...rows.map((row, rowIdx) => new TableRow({
        children: row.map((cell, i) => new TableCell({
          borders: tableBorders,
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { fill: rowIdx % 2 === 0 ? "FFFFFF" : LIGHT_GRAY, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 20, font: "Arial", color: DARK })] })]
        }))
      }))
    ]
  });
}

// ==========================================
// BUILD DOCUMENT
// ==========================================

const children = [];

// ---- COVER PAGE ----
children.push(new Paragraph({ spacing: { before: 3000 }, children: [] }));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 8 } },
  children: [new TextRun({ text: "PROYECTO", size: 56, bold: true, font: "Arial", color: PRIMARY })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: "Implementaci\u00F3n de una Nube Personal", size: 40, font: "Arial", color: DARK })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 300 },
  children: [new TextRun({ text: "con Nextcloud", size: 40, font: "Arial", color: DARK })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "Infraestructura, Contenedores y Automatizaci\u00F3n", size: 24, font: "Arial", color: SECONDARY, italics: true })]
}));
children.push(new Paragraph({ spacing: { after: 600 }, children: [] }));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "Presentado por la Familia Escobar", size: 24, font: "Arial", color: DARK })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "\u00C1rea: Computaci\u00F3n y Programaci\u00F3n", size: 22, font: "Arial", color: SECONDARY })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "Abril 2026", size: 22, font: "Arial", color: DARK })]
}));

// Page break
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 1. INTRODUCCION ----
children.push(heading1("1. Introducci\u00F3n"));

children.push(heading2("1.1 \u00BFQu\u00E9 es una nube personal?"));
children.push(para("Una nube personal es un servicio de almacenamiento y sincronizaci\u00F3n de archivos que funciona en un servidor propio, en lugar de depender de servidores de terceros como Google, Microsoft o Apple. Permite guardar documentos, fotos, v\u00EDdeos y cualquier tipo de archivo, accediendo a ellos desde cualquier dispositivo conectado a internet."));
children.push(para("La principal ventaja de una nube personal es el control total sobre los datos: nadie m\u00E1s tiene acceso a la informaci\u00F3n almacenada, a diferencia de los servicios comerciales donde los archivos residen en servidores de empresas que pueden analizar, compartir o perder esos datos."));

children.push(heading2("1.2 Objetivo del proyecto"));
children.push(para("Implementar un servicio de almacenamiento en la nube privado, seguro y accesible desde cualquier lugar del mundo, utilizando tecnolog\u00EDas de c\u00F3digo abierto (open source) y un servidor dedicado de bajo consumo energ\u00E9tico (NUC), con un costo operativo m\u00EDnimo."));

children.push(heading2("1.3 Comparaci\u00F3n con servicios comerciales"));
children.push(makeTable(
  ["Caracter\u00EDstica", "Google Drive", "Dropbox", "Nube Personal (Nextcloud)"],
  [
    ["Almacenamiento", "15 GB gratis / 2 TB $10/mes", "2 GB gratis / 2 TB $12/mes", "1.7 TB (disco propio)"],
    ["Costo anual", "$120 USD (2 TB)", "$144 USD (2 TB)", "~$46 USD (dominio + luz)"],
    ["Privacidad", "Google accede a datos", "Dropbox accede a datos", "Control total"],
    ["Usuarios", "Limitado por plan", "Limitado por plan", "Ilimitados"],
    ["Personalizaci\u00F3n", "M\u00EDnima", "M\u00EDnima", "Total"],
    ["Disponibilidad", "99.9%", "99.9%", "Depende del servidor"],
  ],
  [2200, 2000, 2000, 3160]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 2. CONCEPTOS FUNDAMENTALES ----
children.push(heading1("2. Conceptos Fundamentales y Glosario T\u00E9cnico"));
children.push(para("A continuaci\u00F3n se explican los conceptos y t\u00E9rminos t\u00E9cnicos utilizados a lo largo del proyecto, organizados por categor\u00EDa."));

// Redes
children.push(heading2("2.1 Redes y Comunicaciones"));
children.push(bulletBold("IP (Internet Protocol): ", "Direcci\u00F3n num\u00E9rica \u00FAnica que identifica a cada dispositivo en una red. Es como la direcci\u00F3n postal de una computadora. Ejemplo: 192.168.1.69.", "bullets"));
children.push(bulletBold("DNS (Domain Name System): ", "Sistema que traduce nombres de dominio legibles (como cloud.hexa38.com) a direcciones IP num\u00E9ricas. Funciona como una agenda telef\u00F3nica de internet.", "bullets"));
children.push(bulletBold("HTTPS/SSL/TLS: ", "Protocolos de comunicaci\u00F3n segura que cifran los datos entre el navegador y el servidor. El candado verde en el navegador indica que la conexi\u00F3n usa HTTPS.", "bullets"));
children.push(bulletBold("Puerto: ", "Punto de entrada/salida de datos en un dispositivo. Cada servicio usa un puerto espec\u00EDfico: el puerto 80 para HTTP, 443 para HTTPS, 22 para SSH.", "bullets"));
children.push(bulletBold("Firewall (UFW): ", "Barrera de seguridad que filtra el tr\u00E1fico de red, permitiendo solo conexiones autorizadas. UFW (Uncomplicated Firewall) es la herramienta de firewall de Ubuntu.", "bullets"));
children.push(bulletBold("SSH (Secure Shell): ", "Protocolo que permite acceder remotamente a un servidor de forma segura y cifrada, como si estuvieras sentado frente a \u00E9l.", "bullets"));
children.push(bulletBold("Tunnel (T\u00FAnel): ", "Conexi\u00F3n segura y cifrada que atraviesa internet sin necesidad de abrir puertos en el router. Cloudflare Tunnel conecta el servidor con internet de forma segura.", "bullets"));
children.push(bulletBold("HSTS: ", "Pol\u00EDtica de seguridad HTTP que obliga al navegador a usar siempre HTTPS, evitando conexiones inseguras.", "bullets"));

// Sistemas Operativos
children.push(heading2("2.2 Sistemas Operativos y Servidores"));
children.push(bulletBold("Linux (Ubuntu Server): ", "Sistema operativo de c\u00F3digo abierto, gratuito y optimizado para servidores. No tiene interfaz gr\u00E1fica, lo que lo hace m\u00E1s ligero y seguro. Es el sistema m\u00E1s usado en servidores web del mundo.", "bullets2"));
children.push(bulletBold("NUC (Next Unit of Computing): ", "Mini computadora de Intel, del tama\u00F1o de una mano, ideal para servidores dom\u00E9sticos por su bajo consumo energ\u00E9tico (~10-15 watts) y funcionamiento silencioso.", "bullets2"));
children.push(bulletBold("Swap: ", "Memoria virtual que usa espacio del disco duro como extensi\u00F3n de la RAM. Cuando la RAM se llena, el sistema usa el swap para evitar quedarse sin memoria.", "bullets2"));
children.push(bulletBold("ext4: ", "Sistema de archivos nativo de Linux. Es robusto, soporta archivos grandes y tiene mecanismos de recuperaci\u00F3n ante fallos.", "bullets2"));
children.push(bulletBold("NTFS: ", "Sistema de archivos de Windows. Compatible pero no \u00F3ptimo para Linux.", "bullets2"));
children.push(bulletBold("Montaje de discos: ", "Proceso de hacer accesible un disco al sistema operativo, asign\u00E1ndole un punto de acceso (como /mnt/nextcloud).", "bullets2"));

// Contenedores
children.push(heading2("2.3 Contenedores y Virtualizaci\u00F3n"));
children.push(bulletBold("Docker: ", "Plataforma que empaqueta aplicaciones junto con todas sus dependencias en contenedores aislados. Esto garantiza que la aplicaci\u00F3n funcione igual en cualquier sistema.", "bullets3"));
children.push(bulletBold("Contenedor: ", "Entorno ligero y aislado que ejecuta una aplicaci\u00F3n. A diferencia de una m\u00E1quina virtual, comparte el kernel del sistema operativo, lo que lo hace m\u00E1s eficiente.", "bullets3"));
children.push(bulletBold("Imagen Docker: ", "Plantilla de solo lectura que contiene el software y configuraci\u00F3n necesarios para crear un contenedor. Es como un molde.", "bullets3"));
children.push(bulletBold("Docker Compose: ", "Herramienta que permite definir y ejecutar m\u00FAltiples contenedores con un solo archivo YAML (docker-compose.yml).", "bullets3"));
children.push(bulletBold("Volumen: ", "Almacenamiento persistente para contenedores. Los datos en un volumen sobreviven aunque el contenedor se elimine.", "bullets3"));
children.push(bulletBold("Red Docker (bridge): ", "Red virtual que conecta contenedores entre s\u00ED, permiti\u00E9ndoles comunicarse de forma aislada del resto de la red.", "bullets3"));

// Base de Datos
children.push(heading2("2.4 Base de Datos"));
children.push(bulletBold("MariaDB: ", "Sistema de gesti\u00F3n de bases de datos relacional, derivado de MySQL. Almacena toda la informaci\u00F3n estructurada de Nextcloud: usuarios, archivos, configuraci\u00F3n.", "bullets4"));
children.push(bulletBold("SQL (Structured Query Language): ", "Lenguaje est\u00E1ndar para consultar y manipular datos en bases de datos relacionales.", "bullets4"));
children.push(bulletBold("Dump: ", "Exportaci\u00F3n completa de una base de datos a un archivo SQL, utilizado para respaldos y migraciones.", "bullets4"));

// Cache
children.push(heading2("2.5 Cache y Rendimiento"));
children.push(bulletBold("Redis: ", "Almac\u00E9n de datos en memoria (RAM) que funciona como cache. Acelera Nextcloud almacenando temporalmente datos de acceso frecuente.", "bullets5"));
children.push(bulletBold("Cache: ", "Almacenamiento temporal de datos frecuentemente consultados para acelerar el acceso. Reduce la carga en la base de datos.", "bullets5"));
children.push(bulletBold("APCu: ", "Cache local de PHP en memoria, utilizado por Nextcloud para almacenar datos de sesi\u00F3n.", "bullets5"));

// Seguridad
children.push(heading2("2.6 Seguridad"));
children.push(bulletBold("2FA/TOTP: ", "Autenticaci\u00F3n de dos factores. Adem\u00E1s de la contrase\u00F1a, requiere un c\u00F3digo temporal generado por una app en el celular (como Google Authenticator). TOTP = Time-based One-Time Password.", "bullets6"));
children.push(bulletBold("WHOIS: ", "Registro p\u00FAblico que contiene informaci\u00F3n sobre qui\u00E9n registr\u00F3 un dominio. Cloudflare oculta estos datos por privacidad.", "bullets6"));
children.push(bulletBold("Contrase\u00F1a de aplicaci\u00F3n: ", "Credencial espec\u00EDfica generada para que apps externas accedan a un servicio (como Gmail SMTP) sin usar la contrase\u00F1a principal.", "bullets6"));
children.push(bulletBold("Fuerza bruta: ", "Ataque que prueba sistem\u00E1ticamente todas las combinaciones posibles de contrase\u00F1as hasta encontrar la correcta.", "bullets6"));

// Dominio
children.push(heading2("2.7 Dominio y DNS"));
children.push(bulletBold("Dominio: ", "Nombre \u00FAnico en internet que identifica un sitio web (ej: hexa38.com). Se registra anualmente.", "bullets7"));
children.push(bulletBold("Subdominio: ", "Extensi\u00F3n de un dominio principal (ej: cloud.hexa38.com). Permite organizar diferentes servicios bajo un mismo dominio.", "bullets7"));
children.push(bulletBold("Cloudflare: ", "Servicio que proporciona DNS, protecci\u00F3n contra ataques, certificados SSL gratuitos y t\u00FAneles seguros.", "bullets7"));
children.push(bulletBold("Nameservers: ", "Servidores que resuelven nombres de dominio a direcciones IP. Son la primera parada cuando escribes una URL.", "bullets7"));

// Automatizacion
children.push(heading2("2.8 Automatizaci\u00F3n"));
children.push(bulletBold("Cron/Crontab: ", "Programador de tareas autom\u00E1ticas en Linux. Permite ejecutar scripts en horarios definidos (ej: backup diario a las 3 AM).", "bullets8"));
children.push(bulletBold("Script: ", "Archivo de texto con instrucciones que se ejecutan secuencialmente para automatizar tareas.", "bullets8"));
children.push(bulletBold("Backup: ", "Copia de seguridad de datos que permite restaurar la informaci\u00F3n en caso de fallo o p\u00E9rdida.", "bullets8"));
children.push(bulletBold("IaC (Infrastructure as Code): ", "Pr\u00E1ctica de gestionar y provisionar infraestructura tecnol\u00F3gica mediante archivos de c\u00F3digo versionables y reproducibles.", "bullets8"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 3. DISCIPLINAS APLICADAS ----
children.push(heading1("3. Disciplinas y Ramas Aplicadas"));
children.push(para("Este proyecto integra m\u00FAltiples disciplinas de la computaci\u00F3n e ingenier\u00EDa de sistemas:"));

children.push(makeTable(
  ["Disciplina", "Descripci\u00F3n", "Aplicaci\u00F3n en el Proyecto"],
  [
    ["Administraci\u00F3n de Sistemas (SysAdmin)", "Gesti\u00F3n de servidores y sistemas operativos", "Instalaci\u00F3n de Ubuntu Server, configuraci\u00F3n de discos, swap, servicios"],
    ["Redes de Computadoras", "Configuraci\u00F3n de conectividad y comunicaciones", "DNS, Cloudflare Tunnel, firewall UFW, puertos, SSH"],
    ["DevOps", "Integraci\u00F3n de desarrollo y operaciones", "Docker, Docker Compose, contenedores, despliegue automatizado"],
    ["Seguridad Inform\u00E1tica", "Protecci\u00F3n de sistemas y datos", "HTTPS, 2FA, firewall, HSTS, actualizaciones autom\u00E1ticas"],
    ["Bases de Datos", "Dise\u00F1o, gesti\u00F3n y respaldo de datos", "MariaDB, dumps SQL, migraciones, restauraciones"],
    ["Programaci\u00F3n / Scripting", "Automatizaci\u00F3n mediante c\u00F3digo", "Scripts Bash y PowerShell para backups"],
    ["Cloud Computing", "Servicios en la nube y acceso remoto", "Cloudflare, t\u00FAneles, dominio, DNS"],
    ["Infrastructure as Code", "Infraestructura como c\u00F3digo reproducible", "docker-compose.yml, .env, scripts de configuraci\u00F3n"],
  ],
  [2200, 2600, 4560]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 4. ARQUITECTURA ----
children.push(heading1("4. Arquitectura del Proyecto"));

children.push(heading2("4.1 Componentes f\u00EDsicos"));
children.push(makeTable(
  ["Componente", "Especificaci\u00F3n", "Funci\u00F3n"],
  [
    ["NUC (Intel)", "4 GB RAM, WiFi/Ethernet", "Servidor f\u00EDsico 24/7"],
    ["Disco M.2 SSD", "297 GB", "Sistema operativo Ubuntu Server"],
    ["Disco externo WD", "2 TB (1.8 TB \u00FAtiles)", "Almacenamiento de datos Nextcloud"],
    ["Router", "Conexi\u00F3n a internet", "Conectividad de red"],
  ],
  [2500, 2800, 4060]
));

children.push(heading2("4.2 Flujo de datos"));
children.push(para("El siguiente diagrama muestra c\u00F3mo fluyen los datos desde cualquier dispositivo hasta el servidor:"));
children.push(spacer());

// Flow diagram as styled paragraphs
const flowSteps = [
  "Dispositivo (celular, PC, tablet)",
  "\u2193",
  "cloud.hexa38.com (dominio)",
  "\u2193",
  "Cloudflare (CDN + SSL + seguridad)",
  "\u2193",
  "Tunnel cifrado (sin abrir puertos)",
  "\u2193",
  "NUC hexa38-nuc (Ubuntu Server)",
  "\u2193",
  "Docker Engine",
  "\u2193",
  "Nextcloud App (contenedor)"
];
flowSteps.forEach(step => {
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: step === "\u2193" ? 0 : 40 },
    children: [new TextRun({
      text: step,
      size: step === "\u2193" ? 20 : 22,
      font: step === "\u2193" ? "Arial" : "Arial",
      bold: step !== "\u2193",
      color: step === "\u2193" ? MID_GRAY : PRIMARY
    })]
  }));
});

children.push(heading2("4.3 Contenedores Docker"));
children.push(makeTable(
  ["Contenedor", "Imagen", "Funci\u00F3n", "Puerto"],
  [
    ["nextcloud-app", "nextcloud:latest", "Servidor web Nextcloud", "9000:80"],
    ["nextcloud-db", "mariadb:10.11", "Base de datos", "3306 (interno)"],
    ["nextcloud-redis", "redis:alpine", "Cache y sesiones", "6379 (interno)"],
    ["nextcloud-cron", "nextcloud:latest", "Tareas programadas", "N/A"],
    ["nextcloud-tunnel", "cloudflare/cloudflared", "Acceso remoto seguro", "N/A"],
  ],
  [2200, 2400, 2800, 1960]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 5. DESARROLLO PASO A PASO ----
children.push(heading1("5. Desarrollo Paso a Paso"));

// Fase 1
children.push(heading2("Fase 1: Configuraci\u00F3n inicial en PC Windows (Prototipo)"));
children.push(para("El proyecto comenz\u00F3 como prototipo en una PC con Windows y Docker Desktop, lo que permiti\u00F3 validar la configuraci\u00F3n antes de migrar a un servidor dedicado."));
children.push(heading3("Pasos realizados:"));
children.push(bulletBold("Instalaci\u00F3n de Docker Desktop: ", "Plataforma que permite ejecutar contenedores en Windows mediante WSL2 (Windows Subsystem for Linux).", "bullets9"));
children.push(bulletBold("Creaci\u00F3n del docker-compose.yml: ", "Archivo que define los 5 servicios (Nextcloud, MariaDB, Redis, Cron, Tunnel) y c\u00F3mo se relacionan entre s\u00ED.", "bullets9"));
children.push(bulletBold("Configuraci\u00F3n de variables de entorno (.env): ", "Archivo separado con contrase\u00F1as y tokens sensibles, evitando exponerlos en el c\u00F3digo.", "bullets9"));
children.push(bulletBold("Primer arranque y verificaci\u00F3n: ", "Ejecuci\u00F3n de docker compose up -d y verificaci\u00F3n del funcionamiento con curl http://localhost:9000/status.php.", "bullets9"));

// Fase 2
children.push(heading2("Fase 2: Registro de dominio y acceso remoto"));
children.push(para("Para acceder a la nube desde cualquier lugar, se necesita un dominio y un mecanismo de conexi\u00F3n segura."));
children.push(heading3("Pasos realizados:"));
children.push(bulletBold("Registro de hexa38.com en Cloudflare: ", "Dominio registrado a precio de costo ($10.11 USD/a\u00F1o). Cloudflare incluye protecci\u00F3n de privacidad WHOIS gratuita.", "bullets10"));
children.push(bulletBold("Configuraci\u00F3n de Cloudflare Tunnel: ", "Se cre\u00F3 un t\u00FAnel seguro que conecta el servidor con Cloudflare sin necesidad de abrir puertos en el router.", "bullets10"));
children.push(bulletBold("Asignaci\u00F3n del subdominio: ", "Se configur\u00F3 cloud.hexa38.com como punto de acceso p\u00FAblico, apuntando al contenedor Nextcloud (app:80).", "bullets10"));
children.push(bulletBold("HTTPS autom\u00E1tico: ", "Cloudflare proporciona certificado SSL gratuito. Se configur\u00F3 HSTS para forzar siempre conexiones cifradas.", "bullets10"));

// Fase 3
children.push(heading2("Fase 3: Optimizaci\u00F3n y seguridad"));
children.push(para("Se realizaron m\u00FAltiples configuraciones para optimizar el rendimiento y reforzar la seguridad."));
children.push(heading3("Configuraciones aplicadas:"));
children.push(bullet("Dominios de confianza (trusted_domains): cloud.hexa38.com, localhost, IP local", "bullets"));
children.push(bullet("Redis como cache distribuido y para bloqueo de archivos", "bullets"));
children.push(bullet("SMTP con Gmail para notificaciones por correo electr\u00F3nico", "bullets"));
children.push(bullet("Autenticaci\u00F3n de dos factores (2FA/TOTP) para el administrador", "bullets"));
children.push(bullet("Gesti\u00F3n de usuarios: creaci\u00F3n, deshabilitaci\u00F3n y asignaci\u00F3n de roles", "bullets"));
children.push(bullet("Resoluci\u00F3n de todos los avisos de seguridad del panel de administraci\u00F3n", "bullets"));
children.push(bullet("Migraciones de tipos MIME e \u00EDndices de base de datos", "bullets"));

// Fase 4
children.push(heading2("Fase 4: Sistema de backups autom\u00E1ticos"));
children.push(para("Se implement\u00F3 un sistema de respaldo autom\u00E1tico que se ejecuta diariamente."));
children.push(heading3("Componentes del backup:"));
children.push(makeTable(
  ["Componente", "M\u00E9todo", "Contenido"],
  [
    ["Base de datos", "mariadb-dump", "Todas las tablas de Nextcloud"],
    ["Datos de usuarios", "docker cp", "Archivos, fotos, documentos"],
    ["Configuraci\u00F3n", "docker cp", "config.php y archivos de config"],
    ["Archivos Docker", "cp", "docker-compose.yml, .env, hsts.conf"],
  ],
  [2500, 2500, 4360]
));
children.push(spacer());
children.push(para("El backup se ejecuta autom\u00E1ticamente a las 3:00 AM mediante crontab, retiene los \u00FAltimos 7 respaldos y activa el modo mantenimiento durante el proceso para garantizar la integridad de los datos."));

// Fase 5
children.push(heading2("Fase 5: Migraci\u00F3n a servidor dedicado (NUC)"));
children.push(para("La migraci\u00F3n del prototipo en PC al servidor dedicado NUC fue el paso cr\u00EDtico del proyecto."));
children.push(heading3("Proceso de migraci\u00F3n:"));
children.push(bullet("Instalaci\u00F3n de Ubuntu Server 24.04 LTS con kernel HWE en el disco M.2 del NUC", "bullets2"));
children.push(bullet("Formateo del disco externo de 2 TB de NTFS a ext4 y montaje permanente en /mnt/nextcloud", "bullets2"));
children.push(bullet("Instalaci\u00F3n de Docker Engine directamente (sin Docker Desktop, ahorrando ~2 GB de RAM)", "bullets2"));
children.push(bullet("Creaci\u00F3n de archivos de configuraci\u00F3n (docker-compose.yml, .env, hsts.conf)", "bullets2"));
children.push(bullet("Transferencia del backup desde la PC por red local mediante SCP (Secure Copy Protocol)", "bullets2"));
children.push(bullet("Restauraci\u00F3n de la base de datos, datos de usuarios y configuraci\u00F3n", "bullets2"));
children.push(bullet("Verificaci\u00F3n del funcionamiento y redirecci\u00F3n del Cloudflare Tunnel al NUC", "bullets2"));

// Fase 6
children.push(heading2("Fase 6: Hardening del servidor"));
children.push(para("El hardening (endurecimiento) es el proceso de asegurar un servidor reduciendo su superficie de ataque."));
children.push(heading3("Medidas implementadas:"));
children.push(makeTable(
  ["Medida", "Herramienta", "Descripci\u00F3n"],
  [
    ["Swap de 4 GB", "fallocate + mkswap", "Extiende la RAM virtual para evitar que el sistema se quede sin memoria"],
    ["Firewall", "UFW", "Solo permite SSH (puerto 22) y Nextcloud (puerto 9000)"],
    ["Actualizaciones autom\u00E1ticas", "unattended-upgrades", "Instala parches de seguridad autom\u00E1ticamente"],
    ["Rotaci\u00F3n de logs", "Docker daemon.json", "Limita logs a 10 MB por contenedor (m\u00E1ximo 3 archivos)"],
    ["Proxy de confianza", "trusted_proxies", "Identifica correctamente la IP real del usuario a trav\u00E9s de Cloudflare"],
    ["Backup diario", "Crontab + script Bash", "Respaldo autom\u00E1tico a las 3:00 AM con retenci\u00F3n de 7 d\u00EDas"],
  ],
  [2500, 2500, 4360]
));

// Fase 7
children.push(heading2("Fase 7: Resoluci\u00F3n de avisos y acceso remoto SSH"));
children.push(para("Tras la migraci\u00F3n, el panel de administraci\u00F3n de Nextcloud mostr\u00F3 avisos de seguridad que fueron resueltos uno a uno hasta obtener el estado \u00ABHa pasado todos los controles\u00BB."));
children.push(heading3("Avisos resueltos:"));
children.push(makeTable(
  ["Aviso", "Soluci\u00F3n aplicada"],
  [
    ["Directorio de datos accesible desde internet", "Configuraci\u00F3n de Apache para denegar acceso directo al directorio /data mediante data-protect.conf"],
    ["Errores en los registros", "Limpieza del archivo de log (errores hist\u00F3ricos de la migraci\u00F3n)"],
    ["2FA no obligatorio", "Activaci\u00F3n de la obligatoriedad de autenticaci\u00F3n de dos factores para todos los usuarios"],
    ["Migraciones MIME pendientes", "Ejecuci\u00F3n de occ maintenance:repair --include-expensive"],
    ["\u00CDndices de base de datos faltantes", "Ejecuci\u00F3n de occ db:add-missing-indices"],
    ["Encabezado HSTS no configurado", "Creaci\u00F3n de hsts.conf montado como volumen en Apache"],
    ["Regi\u00F3n telef\u00F3nica no configurada", "Configuraci\u00F3n de default_phone_region a PE (Per\u00FA)"],
    ["Ventana de mantenimiento no configurada", "Configuraci\u00F3n de maintenance_window_start a las 5 AM UTC"],
  ],
  [4000, 5360]
));

children.push(heading3("Instalaci\u00F3n de Tailscale (SSH remoto seguro):"));
children.push(para("Para administrar el servidor desde cualquier lugar del mundo, se instal\u00F3 Tailscale, una VPN mesh que crea una red privada entre dispositivos sin necesidad de abrir puertos ni configurar routers."));
children.push(spacer());
children.push(bulletBold("Tailscale: ", "Servicio de red privada virtual (VPN) basado en WireGuard. Cada dispositivo recibe una IP privada (100.x.x.x) accesible desde cualquier lugar.", "bullets5"));
children.push(bulletBold("Tailscale SSH: ", "Permite conexiones SSH autenticadas por Tailscale, eliminando la necesidad de gestionar llaves SSH manualmente.", "bullets5"));
children.push(bulletBold("WireGuard: ", "Protocolo VPN moderno, r\u00E1pido y seguro que Tailscale usa internamente para cifrar el tr\u00E1fico.", "bullets5"));
children.push(spacer());
children.push(para("Con Tailscale configurado, el administrador puede conectarse al servidor desde cualquier red (casa, oficina, celular) ejecutando simplemente: ssh aldo@hexa38-nuc o ssh aldo@100.91.119.52."));

children.push(heading3("Acceso remoto final:"));
children.push(makeTable(
  ["Servicio", "URL / Comando", "Tecnolog\u00EDa"],
  [
    ["Nextcloud (web)", "https://cloud.hexa38.com", "Cloudflare Tunnel"],
    ["SSH al servidor", "ssh aldo@hexa38-nuc", "Tailscale"],
    ["SSH local", "ssh aldo@192.168.1.69", "Red local WiFi/Ethernet"],
  ],
  [2500, 3800, 3060]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 6. ARCHIVOS DE CONFIGURACION ----
children.push(heading1("6. Archivos de Configuraci\u00F3n Clave"));

children.push(heading2("6.1 docker-compose.yml"));
children.push(para("Este archivo define toda la infraestructura como c\u00F3digo. Cada secci\u00F3n declara un servicio (contenedor) con su imagen, configuraci\u00F3n y relaciones."));
children.push(spacer());
children.push(...codeBlock([
  "services:",
  "  db:",
  "    image: mariadb:10.11        # Software a usar",
  "    restart: always              # Reinicio autom\u00E1tico si falla",
  "    volumes:",
  "      - /mnt/nextcloud/db:/var/lib/mysql  # Datos persistentes",
  "    environment:",
  "      - MYSQL_PASSWORD=${MYSQL_PASSWORD}   # Variables desde .env",
  "",
  "  redis:",
  "    image: redis:alpine",
  "    command: redis-server --requirepass ${REDIS_PASSWORD}",
  "",
  "  app:",
  "    image: nextcloud:latest",
  "    ports:",
  "      - 9000:80                  # Puerto externo:interno",
  "    depends_on:                  # Orden de inicio",
  "      - db",
  "      - redis",
  "    volumes:",
  "      - /mnt/nextcloud/html:/var/www/html",
  "      - /mnt/nextcloud/data:/var/www/html/data",
  "",
  "  cron:",
  "    image: nextcloud:latest",
  "    entrypoint: /cron.sh         # Ejecuta tareas programadas",
  "",
  "  tunnel:",
  "    image: cloudflare/cloudflared:latest",
  "    command: tunnel run --token ${CLOUDFLARE_TOKEN}",
]));

children.push(spacer());
children.push(heading3("Explicaci\u00F3n de directivas:"));
children.push(makeTable(
  ["Directiva", "Significado"],
  [
    ["image", "Imagen Docker a usar (software y versi\u00F3n)"],
    ["restart: always", "Si el contenedor falla, Docker lo reinicia autom\u00E1ticamente"],
    ["volumes", "Conecta carpetas del disco con el contenedor (persistencia de datos)"],
    ["environment", "Variables de configuraci\u00F3n (contrase\u00F1as, nombres de host)"],
    ["ports", "Mapeo de puertos: puerto_externo:puerto_interno"],
    ["depends_on", "Define el orden de inicio de los contenedores"],
    ["command", "Comando que ejecuta el contenedor al iniciar"],
    ["entrypoint", "Punto de entrada principal del contenedor"],
    ["networks", "Red virtual para comunicaci\u00F3n entre contenedores"],
  ],
  [3000, 6360]
));

children.push(heading2("6.2 Script de backup (backup.sh)"));
children.push(para("El script de backup sigue una l\u00F3gica secuencial para garantizar la integridad de los datos:"));
children.push(spacer());
children.push(makeTable(
  ["Paso", "Acci\u00F3n", "Prop\u00F3sito"],
  [
    ["1", "Activar modo mantenimiento", "Evitar cambios durante el backup"],
    ["2", "Exportar base de datos (dump)", "Respaldo de toda la informaci\u00F3n estructurada"],
    ["3", "Copiar datos de usuarios", "Respaldo de archivos, fotos, documentos"],
    ["4", "Copiar configuraci\u00F3n", "Respaldo de config.php y ajustes"],
    ["5", "Copiar archivos Docker", "Respaldo de docker-compose.yml y .env"],
    ["6", "Desactivar modo mantenimiento", "Reanudar el servicio normal"],
    ["7", "Limpiar backups antiguos", "Mantener solo los \u00FAltimos 7 respaldos"],
  ],
  [1000, 3200, 5160]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 7. IaC ----
children.push(heading1("7. Infrastructure as Code (IaC)"));

children.push(heading2("7.1 \u00BFQu\u00E9 es Infrastructure as Code?"));
children.push(para("Infrastructure as Code (Infraestructura como C\u00F3digo) es una pr\u00E1ctica moderna que consiste en gestionar y provisionar infraestructura tecnol\u00F3gica mediante archivos de c\u00F3digo, en lugar de configuraciones manuales. Esto permite que la infraestructura sea versionable, reproducible y documentada autom\u00E1ticamente."));

children.push(heading2("7.2 Herramientas principales"));
children.push(makeTable(
  ["Herramienta", "Funci\u00F3n", "Uso en este proyecto"],
  [
    ["Docker Compose", "Define servicios como c\u00F3digo", "Ya implementado: docker-compose.yml define toda la infraestructura"],
    ["Terraform", "Provisiona recursos en la nube", "Potencial: crear VPS en Oracle Cloud o AWS autom\u00E1ticamente"],
    ["Ansible", "Configura servidores autom\u00E1ticamente", "Potencial: automatizar instalaci\u00F3n de Docker y configuraci\u00F3n"],
    ["Cloud-init", "Inicializa servidores al arrancar", "Potencial: configuraci\u00F3n autom\u00E1tica de Ubuntu Server"],
    ["Git", "Control de versiones", "Potencial: versionar todos los archivos de configuraci\u00F3n"],
  ],
  [2200, 2800, 4360]
));

children.push(heading2("7.3 Beneficios de IaC"));
children.push(bulletBold("Reproducibilidad: ", "La misma configuraci\u00F3n produce el mismo resultado cada vez. Si el servidor falla, se puede reconstruir desde cero en minutos.", "bullets3"));
children.push(bulletBold("Versionado: ", "Los cambios en la infraestructura quedan registrados en Git, permiti\u00E9ndote ver qu\u00E9 cambi\u00F3, cu\u00E1ndo y por qu\u00E9.", "bullets3"));
children.push(bulletBold("Documentaci\u00F3n autom\u00E1tica: ", "El c\u00F3digo mismo es la documentaci\u00F3n. No hay pasos manuales que olvidar.", "bullets3"));
children.push(bulletBold("Escalabilidad: ", "Desplegar el mismo servicio en m\u00FAltiples servidores es tan f\u00E1cil como copiar los archivos.", "bullets3"));

children.push(heading2("7.4 C\u00F3mo reproducir este proyecto con IaC"));
children.push(para("Con los archivos de este proyecto (docker-compose.yml, .env, hsts.conf, backup.sh), cualquier persona puede replicar la nube personal completa siguiendo estos pasos:"));
children.push(spacer());
children.push(...codeBlock([
  "# 1. Instalar Docker",
  "curl -fsSL https://get.docker.com | sudo sh",
  "",
  "# 2. Copiar archivos de configuraci\u00F3n",
  "scp -r usuario@servidor-origen:~/nextcloud ~/nextcloud",
  "",
  "# 3. Levantar toda la infraestructura",
  "cd ~/nextcloud && docker compose up -d",
  "",
  "# 4. Restaurar backup",
  "docker exec -i nextcloud-db bash -c \\",
  "  'mariadb -u root -p\"$MYSQL_ROOT_PASSWORD\" nextcloud' < backup/database.sql",
]));
children.push(spacer());
children.push(para("Con estos 4 pasos, toda la infraestructura queda funcionando: Nextcloud, base de datos, cache, tareas programadas y acceso remoto. Esto es el poder de Infrastructure as Code."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 8. COSTOS ----
children.push(heading1("8. Costos del Proyecto"));

children.push(makeTable(
  ["Concepto", "Costo", "Frecuencia"],
  [
    ["Dominio hexa38.com (Cloudflare)", "$10.11 USD", "Anual"],
    ["Cloudflare Tunnel", "Gratis", "-"],
    ["Nextcloud (c\u00F3digo abierto)", "Gratis", "-"],
    ["Docker Engine", "Gratis", "-"],
    ["Ubuntu Server", "Gratis", "-"],
    ["NUC (hardware)", "Ya existente", "-"],
    ["Disco WD 2 TB", "Ya existente", "-"],
    ["Electricidad del NUC (~15W)", "~$2-3 USD", "Mensual"],
    ["TOTAL ANUAL", "~$46 USD", ""],
  ],
  [4000, 2500, 2860]
));
children.push(spacer());
children.push(heading3("Comparaci\u00F3n de costos anuales:"));
children.push(makeTable(
  ["Servicio", "Almacenamiento", "Costo anual"],
  [
    ["Google One", "2 TB", "$120 USD"],
    ["Dropbox Plus", "2 TB", "$144 USD"],
    ["iCloud+", "2 TB", "$131 USD"],
    ["Nube Personal (este proyecto)", "1.7 TB", "$46 USD"],
  ],
  [3500, 2500, 3360]
));
children.push(spacer());
children.push(para("El proyecto representa un ahorro del 60-68% respecto a servicios comerciales, con la ventaja adicional de privacidad total, usuarios ilimitados y control completo sobre los datos."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 9. RESULTADOS ----
children.push(heading1("9. Resultados"));

children.push(para("El proyecto logr\u00F3 todos los objetivos planteados:"));
children.push(spacer());
children.push(makeTable(
  ["Objetivo", "Estado", "Detalle"],
  [
    ["Nube personal funcionando", "Completado", "Nextcloud 33.0.2 operativo 24/7"],
    ["Acceso remoto", "Completado", "cloud.hexa38.com accesible desde cualquier lugar"],
    ["Almacenamiento", "Completado", "1.7 TB disponibles en disco de 2 TB"],
    ["Seguridad", "Completado", "HTTPS, 2FA, firewall, actualizaciones autom\u00E1ticas"],
    ["Backups", "Completado", "Respaldo diario autom\u00E1tico a las 3 AM"],
    ["Bajo costo", "Completado", "~$46 USD/a\u00F1o vs $120+ en servicios comerciales"],
    ["Privacidad", "Completado", "Control total sobre los datos, sin terceros"],
    ["Multi-dispositivo", "Completado", "Apps para Android, iOS, Windows, Mac, Linux"],
  ],
  [2500, 1800, 5060]
));

children.push(spacer());
children.push(heading2("Estad\u00EDsticas del servidor"));
children.push(makeTable(
  ["M\u00E9trica", "Valor"],
  [
    ["RAM total", "3.7 GB + 7.7 GB swap"],
    ["RAM usada (sistema + Docker)", "~985 MB"],
    ["Disco disponible", "1.7 TB de 1.8 TB"],
    ["Contenedores activos", "5"],
    ["Tiempo de arranque", "< 2 minutos"],
    ["Conexiones del tunnel", "Santiago (SCL) + Lima (LIM)"],
  ],
  [4000, 5360]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 10. CONCLUSIONES ----
children.push(heading1("10. Conclusiones"));

children.push(bullet("Este proyecto demuestra que es posible integrar m\u00FAltiples disciplinas de la computaci\u00F3n (redes, sistemas, seguridad, bases de datos, DevOps) en una soluci\u00F3n pr\u00E1ctica y funcional.", "bullets4"));
children.push(spacer());
children.push(bullet("Los contenedores Docker simplifican enormemente el despliegue de servicios complejos. Lo que antes requer\u00EDa d\u00EDas de configuraci\u00F3n manual, ahora se define en un archivo YAML y se levanta con un solo comando.", "bullets4"));
children.push(spacer());
children.push(bullet("La automatizaci\u00F3n (backups, actualizaciones, cron) reduce errores humanos y garantiza consistencia. Un servidor bien automatizado requiere m\u00EDnima intervenci\u00F3n manual.", "bullets4"));
children.push(spacer());
children.push(bullet("El self-hosting (alojamiento propio) es una alternativa viable, econ\u00F3mica y educativa a los servicios en la nube comerciales, especialmente para usuarios que valoran la privacidad y el control de sus datos.", "bullets4"));
children.push(spacer());
children.push(bullet("Infrastructure as Code (IaC) permite reproducir toda la infraestructura de forma consistente, facilitando migraciones, recuperaci\u00F3n ante desastres y escalamiento a nuevos proyectos.", "bullets4"));
children.push(spacer());
children.push(bullet("El proyecto evolucion\u00F3 desde un prototipo en PC hasta un servidor dedicado 24/7, demostrando un ciclo completo de desarrollo: prototipado, pruebas, optimizaci\u00F3n, migraci\u00F3n y hardening.", "bullets4"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 11. REFERENCIAS ----
children.push(heading1("11. Referencias y Recursos"));

children.push(heading2("Tecnolog\u00EDas utilizadas"));
const refs = [
  ["Nextcloud", "https://nextcloud.com", "Plataforma de nube personal de c\u00F3digo abierto"],
  ["Docker", "https://docker.com", "Plataforma de contenedores"],
  ["Cloudflare", "https://cloudflare.com", "DNS, seguridad y t\u00FAneles"],
  ["Ubuntu Server", "https://ubuntu.com/server", "Sistema operativo para servidores"],
  ["MariaDB", "https://mariadb.org", "Sistema de gesti\u00F3n de bases de datos"],
  ["Redis", "https://redis.io", "Almac\u00E9n de datos en memoria"],
];
children.push(makeTable(
  ["Tecnolog\u00EDa", "Sitio web", "Descripci\u00F3n"],
  refs,
  [2000, 3200, 4160]
));

children.push(heading2("Herramientas de IaC (referencia)"));
const iacRefs = [
  ["Terraform", "https://terraform.io", "Provisionamiento de infraestructura en la nube"],
  ["Ansible", "https://ansible.com", "Automatizaci\u00F3n de configuraci\u00F3n de servidores"],
  ["Git", "https://git-scm.com", "Control de versiones de c\u00F3digo"],
];
children.push(makeTable(
  ["Herramienta", "Sitio web", "Descripci\u00F3n"],
  iacRefs,
  [2000, 3200, 4160]
));

// ==========================================
// CREATE DOCUMENT
// ==========================================
const doc = new Document({
  numbering: numberingConfig,
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22 } }
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: PRIMARY },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: SECONDARY },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 }
      },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: MID_GRAY, space: 4 } },
          children: [
            new TextRun({ text: "Proyecto Nube Personal con Nextcloud", size: 16, font: "Arial", color: MID_GRAY, italics: true }),
            new TextRun({ text: "  |  Familia Escobar", size: 16, font: "Arial", color: MID_GRAY, italics: true }),
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "P\u00E1gina ", size: 16, font: "Arial", color: MID_GRAY }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: MID_GRAY }),
          ]
        })]
      })
    },
    children: children
  }]
});

const OUTPUT = "D:\\Proyecto Nube Nextcloud\\Proyecto_Nube_Personal_Nextcloud.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Documento creado: " + OUTPUT);
});
