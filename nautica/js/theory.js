const THEORY = [
  {
    id: 'scafo',
    title: 'Teoria dello Scafo',
    icon: '⚓',
    color: '#00b4d8',
    qRange: [1, 125],
    sections: [
      {
        title: 'Parti principali dello scafo',
        content: `<p>Lo <strong>scafo</strong> è la struttura principale dell'imbarcazione. Le sue parti fondamentali sono:</p>
<ul>
<li><strong>Prua</strong>: parte anteriore dell'imbarcazione</li>
<li><strong>Poppa</strong>: parte posteriore dell'imbarcazione</li>
<li><strong>Murate</strong>: fianchi laterali dello scafo (murata di dritta a destra, murata di sinistra a sinistra, guardando verso prua)</li>
<li><strong>Chiglia</strong>: elemento strutturale longitudinale che forma la "spina dorsale" dello scafo</li>
<li><strong>Ponte di coperta</strong>: il ponte principale che si estende in modo continuo da prua a poppa</li>
<li><strong>Specchio di poppa</strong>: la superficie verticale della poppa</li>
</ul>
<p>La <strong>lunghezza fuori tutto (LFT)</strong> è la massima lunghezza misurata tra le estremità prodiera e poppiera.</p>`
      },
      {
        title: 'Opera viva e opera morta',
        content: `<p>Lo scafo è diviso in due zone rispetto alla linea di galleggiamento:</p>
<ul>
<li><strong>Opera viva (carena)</strong>: la parte immersa dello scafo, a contatto con l'acqua</li>
<li><strong>Opera morta</strong>: la parte emersa dello scafo, fuori dall'acqua</li>
</ul>
<p>Il <strong>bordo libero</strong> è la distanza verticale tra la linea di galleggiamento e il bordo superiore del ponte di coperta al centro dell'imbarcazione.</p>
<p>Il <strong>pescaggio</strong> è la distanza verticale tra la linea di galleggiamento e il punto inferiore estremo dello scafo.</p>`
      },
      {
        title: 'Stabilità e galleggiamento',
        content: `<p>La <strong>stabilità</strong> è la capacità dell'imbarcazione di resistere all'inclinazione e di tornare in posizione verticale.</p>
<ul>
<li><strong>Stabilità di forma</strong>: dipende dalla forma della carena (più è larga, più è stabile)</li>
<li><strong>Stabilità di peso</strong>: dipende dalla posizione del centro di gravità (G più è basso, meglio è)</li>
<li><strong>Centro di carena (C)</strong>: punto in cui si applica la spinta idrostatica verso l'alto</li>
<li><strong>Metacentro (M)</strong>: se M è sopra G, l'imbarcazione è stabile</li>
</ul>
<p>La <strong>coppia di stabilità</strong> è il momento raddrizzante che riporta l'imbarcazione in posizione verticale dopo un'inclinazione.</p>`
      },
      {
        title: 'Componenti strutturali',
        content: `<p>Le principali componenti strutturali interne:</p>
<ul>
<li><strong>Ordinate (costole)</strong>: elementi trasversali che danno forma allo scafo</li>
<li><strong>Paratie</strong>: elementi divisori verticali che suddividono lo scafo in compartimenti stagni</li>
<li><strong>Sentina</strong>: la parte più bassa interna dello scafo dove si raccolgono acque sporche e residui liquidi</li>
<li><strong>Boccaporti</strong>: aperture nel ponte per accedere ai locali sottostanti</li>
<li><strong>Osteriggi</strong>: piccole aperture nel ponte per luce e ventilazione</li>
</ul>
<p><strong>Bitta</strong>: colonnetta robusta per ormeggio. <strong>Galloccia</strong>: appiglio per rinviare cavi. <strong>Gavone</strong>: vano-ripostiglio a prua o a poppa.</p>`
      },
      {
        title: 'Timone ed elica',
        content: `<p>Il <strong>timone</strong> è l'organo di governo dell'imbarcazione. Funziona creando una forza laterale quando viene messo in angolo rispetto alla direzione del moto.</p>
<ul>
<li><strong>Barra del timone</strong>: leva diretta per manovrare il timone</li>
<li><strong>Ruota del timone</strong>: volante collegato al timone tramite trasmissione</li>
</ul>
<p>L'<strong>elica</strong> trasforma la coppia del motore in spinta propulsiva. Può essere:</p>
<ul>
<li><strong>Passo fisso</strong>: pale con angolo fisso</li>
<li><strong>Passo variabile</strong>: pale con angolo regolabile</li>
</ul>
<p>L'elica destrorsa (vista da poppa) ruota in senso orario quando va avanti. Produce un effetto laterale detto <strong>effetto elica</strong> che sposta la poppa.</p>`
      }
    ]
  },
  {
    id: 'motori',
    title: 'Motori e Meccanica',
    icon: '⚙️',
    color: '#f97316',
    qRange: [126, 229],
    sections: [
      {
        title: 'Tipi di motori marini',
        content: `<p>I motori marini si classificano in base alla posizione:</p>
<ul>
<li><strong>Entrobordo (inboard)</strong>: motore installato all'interno dello scafo, con asse elica passante attraverso lo scafo</li>
<li><strong>Fuoribordo (outboard)</strong>: motore montato sul bordo della poppa, rimovibile, con elica integrata</li>
<li><strong>Entrofuoribordo (sterndrive/IPS)</strong>: motore entrobordo con piede poppiero fuoribordo</li>
</ul>
<p>Per tipo di combustione:</p>
<ul>
<li><strong>Motori a benzina</strong>: ciclo Otto, più leggeri, maggiore rischio incendio</li>
<li><strong>Motori diesel</strong>: ciclo Diesel, più efficienti, meno rischio incendio, torque maggiore</li>
</ul>`
      },
      {
        title: 'Ciclo motore e componenti',
        content: `<p>Il motore a 4 tempi funziona con 4 fasi: <strong>aspirazione → compressione → combustione → scarico</strong>.</p>
<p>Componenti principali:</p>
<ul>
<li><strong>Pistone</strong>: si muove su e giù nel cilindro</li>
<li><strong>Albero a gomiti (albero motore)</strong>: trasforma il moto alternativo in rotatorio</li>
<li><strong>Valvole</strong>: regolano l'ingresso/uscita di gas</li>
<li><strong>Carburatore/iniettori</strong>: dosano il carburante</li>
<li><strong>Candele/iniettori diesel</strong>: innescano la combustione</li>
</ul>
<p>La <strong>cilindrata</strong> è il volume totale dei cilindri. La <strong>potenza</strong> si misura in CV (cavalli vapore) o kW.</p>`
      },
      {
        title: 'Sistemi di raffreddamento e lubrificazione',
        content: `<p>Sistema di <strong>raffreddamento</strong>:</p>
<ul>
<li><strong>Ad acqua di mare</strong>: l'acqua entra dalla valvola Kingston, raffredda il motore ed esce dallo scarico</li>
<li><strong>Ad acqua dolce con scambiatore</strong>: circuito chiuso con antigelo + scambiatore di calore con l'acqua di mare</li>
</ul>
<p>Verificare sempre che l'acqua di raffreddamento esca dallo scarico prima di mettere in moto!</p>
<p>Sistema di <strong>lubrificazione</strong>:</p>
<ul>
<li>L'olio motore riduce l'attrito tra le parti in movimento</li>
<li>Verificare il livello dell'olio a motore freddo con l'asta di livello</li>
<li>Cambiare l'olio a intervalli regolari (tipicamente ogni 100 ore)</li>
</ul>`
      },
      {
        title: 'Avaria motore e manutenzione',
        content: `<p>Cause comuni di avaria:</p>
<ul>
<li><strong>Surriscaldamento</strong>: ostruzione presa acqua, cinghia pompa rotta, termostato difettoso</li>
<li><strong>Mancata accensione</strong>: candele scariche, batteria scarica, carburante esaurito</li>
<li><strong>Perdita di potenza</strong>: filtro carburante intasato, elica danneggiata</li>
<li><strong>Cavitazione</strong>: formazione di bolle d'aria attorno all'elica, riduce efficienza</li>
</ul>
<p>Manutenzione ordinaria:</p>
<ul>
<li>Controllo livelli (olio, carburante, acqua dolce)</li>
<li>Controllo cinghie e connessioni</li>
<li>Pulizia filtri</li>
<li>Protezione contro la corrosione (anodi di zinco)</li>
</ul>`
      }
    ]
  },
  {
    id: 'sicurezza',
    title: 'Sicurezza e Salvataggio',
    icon: '🛟',
    color: '#ef4444',
    qRange: [230, 444],
    sections: [
      {
        title: 'Dotazioni di sicurezza obbligatorie',
        content: `<p>Per la navigazione <strong>entro 6 miglia</strong> dalla costa, le dotazioni obbligatorie includono:</p>
<ul>
<li>Giubbotti salvagente omologati per ogni persona a bordo</li>
<li>Anello salvagente</li>
<li>Estintore portatile</li>
<li>Segnali visivi di soccorso (razzi a paracadute, razzi a mano, fumogeni)</li>
<li>Bussola</li>
<li>Cima di ormeggio</li>
<li>Ancora con cima adeguata</li>
</ul>
<p>Per la navigazione <strong>entro 12 miglia</strong> si aggiungono: zattera di salvataggio o battello pneumatico, VHF, ecoscandaglio.</p>`
      },
      {
        title: 'Giubbotti e mezzi di salvataggio',
        content: `<p>I <strong>giubbotti salvagente</strong> si distinguono per:</p>
<ul>
<li><strong>Tipo 50</strong>: 50 N di spinta, per acque protette</li>
<li><strong>Tipo 100</strong>: 100 N di spinta, per acque costiere</li>
<li><strong>Tipo 150</strong>: 150 N di spinta, per acque offshore (si autoraddrizza)</li>
<li><strong>Tipo 275</strong>: 275 N di spinta, per condizioni estreme</li>
</ul>
<p>La <strong>zattera di salvataggio</strong> è obbligatoria oltre le 6 miglia. Deve essere omologata, in scatola ermetica o container rigido, con cima di innesco (painter line).</p>
<p>L'<strong>anello salvagente</strong> deve essere lanciato immediatamente in caso di uomo in mare.</p>`
      },
      {
        title: 'Segnali di soccorso',
        content: `<p>I segnali di soccorso visivi:</p>
<ul>
<li><strong>Razzi a paracadute</strong>: visibili fino a 40 km, bruciano per 40 secondi a 300m di altezza</li>
<li><strong>Razzi a mano</strong>: luce rossa, visibili a breve distanza</li>
<li><strong>Fumogeni arancioni</strong>: usati di giorno, visibili fino a 5 km</li>
<li><strong>Specchio di segnalazione</strong>: riflette la luce solare verso i soccorritori</li>
</ul>
<p>Segnali radio:</p>
<ul>
<li><strong>MAYDAY</strong>: pericolo imminente, rischio di vita (canale VHF 16)</li>
<li><strong>PAN-PAN</strong>: urgenza, situazione seria ma non imminente pericolo di vita</li>
<li><strong>SÉCURITÉ</strong>: avviso di navigazione o meteorologico</li>
</ul>`
      },
      {
        title: 'Prevenzione e lotta antincendio',
        content: `<p>Classi di incendio:</p>
<ul>
<li><strong>Classe A</strong>: materiali solidi (legno, tessuti) → acqua o schiuma</li>
<li><strong>Classe B</strong>: liquidi infiammabili (benzina, gasolio) → schiuma, CO₂, polvere</li>
<li><strong>Classe C</strong>: gas infiammabili → polvere, CO₂</li>
<li><strong>Classe D</strong>: metalli → polveri speciali</li>
</ul>
<p>NON usare mai acqua su incendi di classe B (liquidi infiammabili) e C (gas)!</p>
<p>Prevenzione a bordo:</p>
<ul>
<li>Ventilare il vano motore prima dell'avviamento</li>
<li>Non fumare durante il rifornimento</li>
<li>Controllare perdite di carburante</li>
<li>Tenere la sentina pulita da carburante</li>
</ul>`
      },
      {
        title: 'Uomo in mare',
        content: `<p>Procedura in caso di <strong>uomo in mare</strong>:</p>
<ol>
<li>Lanciare subito l'anello salvagente (con luci e sagola)</li>
<li>Gridare "Uomo in mare!"</li>
<li>Designare un osservatore che non perda di vista il naufrago</li>
<li>Trasmettere MAYDAY sul VHF canale 16</li>
<li>Avvicinarsi controvento/controcorrente</li>
<li>Fermare il motore prima di avvicinarsi al naufrago per evitare danni dell'elica</li>
</ol>
<p>Manovre di recupero:</p>
<ul>
<li><strong>Manovra di Williamson</strong>: usata su grandi navi, porta l'unità sul percorso inverso</li>
<li><strong>Manovra a boutade</strong>: accostata rapida e recupero con vento in poppa</li>
</ul>`
      }
    ]
  },
  {
    id: 'navigazione',
    title: 'Navigazione',
    icon: '🧭',
    color: '#8b5cf6',
    qRange: [445, 598],
    sections: [
      {
        title: 'Rosa dei venti e direzioni',
        content: `<p>La <strong>rosa dei venti</strong> divide l'orizzonte in 360°:</p>
<ul>
<li>Nord (N) = 0°/360°, Est (E) = 90°, Sud (S) = 180°, Ovest (O/W) = 270°</li>
<li>NE = 45°, SE = 135°, SO = 225°, NO = 315°</li>
</ul>
<p>Posizioni relative a bordo:</p>
<ul>
<li><strong>Dritta</strong>: destra guardando verso prua</li>
<li><strong>Sinistra</strong>: sinistra guardando verso prua</li>
<li><strong>Mascone</strong>: zona diagonale anteriore (mascone di dritta/sinistra)</li>
<li><strong>Giardinetto</strong>: zona diagonale posteriore (giardinetto di dritta/sinistra)</li>
<li><strong>Traverso</strong>: perpendicolare all'asse longitudinale</li>
</ul>`
      },
      {
        title: 'Regole di precedenza',
        content: `<p>Le regole di precedenza tra imbarcazioni (COLREG):</p>
<ul>
<li>I <strong>velieri</strong> hanno precedenza sui <strong>motoscafi</strong> (in navigazione a vela)</li>
<li>I <strong>pescatori</strong> con attrezzi in acqua hanno precedenza</li>
<li>Le <strong>navi limitate in manovrabilità</strong> hanno precedenza</li>
<li>Le <strong>navi in difficoltà</strong> hanno sempre la precedenza</li>
</ul>
<p>Tra motoscafi in rotta di collisione:</p>
<ul>
<li>Chi viene da <strong>dritta</strong> ha la precedenza</li>
<li>Chi si incrocia a sinistra deve cedere (accostare a dritta)</li>
<li>Chi <strong>raggiunge</strong> da poppa deve sempre cedere il passo</li>
</ul>`
      },
      {
        title: 'Ormeggio e ancoraggio',
        content: `<p><strong>Ormeggio</strong> - tipi di cime:</p>
<ul>
<li><strong>Cima di prua</strong>: da prua verso la banchina in avanti</li>
<li><strong>Cima di poppa</strong>: da poppa verso la banchina in dietro</li>
<li><strong>Spring di prua</strong>: da prua verso la banchina in dietro (impedisce avanzamento)</li>
<li><strong>Spring di poppa</strong>: da poppa verso la banchina in avanti (impedisce arretramento)</li>
</ul>
<p><strong>Ancoraggio</strong>:</p>
<ul>
<li>La lunghezza della catena/sagola deve essere 5-7 volte la profondità del fondale</li>
<li>Verificare il fondale con l'ecoscandaglio</li>
<li>Tipi di ancore: ammiragliato, danforth, CQR (vomere), Bruce</li>
<li>Il <strong>cerchio di ancoraggio</strong> è l'area che l'imbarcazione può occupare a seconda del vento</li>
</ul>`
      },
      {
        title: 'Correnti e maree',
        content: `<p>Le <strong>maree</strong> sono causate dall'attrazione gravitazionale di Luna e Sole:</p>
<ul>
<li><strong>Alta marea (plenum)</strong>: massimo livello dell'acqua</li>
<li><strong>Bassa marea (minimum)</strong>: minimo livello dell'acqua</li>
<li><strong>Marea di sigizia</strong>: luna piena/nuova, maree più alte (Luna e Sole allineati)</li>
<li><strong>Marea di quadratura</strong>: luna a metà, maree più basse (Luna e Sole in quadratura)</li>
</ul>
<p>Le <strong>correnti marine</strong> influenzano la navigazione. La differenza tra rotta seguita (rotta vera) e rotta stimata si chiama <strong>deriva</strong>.</p>`
      }
    ]
  },
  {
    id: 'colreg',
    title: 'COLREG e Segnalamento',
    icon: '🚦',
    color: '#10b981',
    qRange: [599, 845],
    sections: [
      {
        title: 'COLREG 72 - Principi generali',
        content: `<p>Il <strong>COLREG 72</strong> (Collision Regulations) è il regolamento internazionale per prevenire gli abbordi in mare, in vigore dal 1977.</p>
<p>Principi fondamentali:</p>
<ul>
<li>Ogni imbarcazione deve mantenere una <strong>buona vedetta</strong> (vista e udito)</li>
<li>Navigare sempre a <strong>velocità di sicurezza</strong> adeguata alle condizioni</li>
<li>Regola della <strong>buona prassi marinara</strong></li>
</ul>
<p>L'imbarcazione che deve cedere il passo è detta <strong>"nave soggetta"</strong> e deve manovrare per tempo in modo evidente. L'altra è la <strong>"nave privilegiata"</strong> che mantiene rotta e velocità.</p>`
      },
      {
        title: 'Luci di navigazione',
        content: `<p>Le luci obbligatorie di notte (e in scarsa visibilità):</p>
<ul>
<li><strong>Luce di testa d'albero (bianca)</strong>: visibile a 225° su prua, portata 5 miglia</li>
<li><strong>Luce di dritta (verde)</strong>: visibile a 112,5° sul lato destro</li>
<li><strong>Luce di sinistra (rossa)</strong>: visibile a 112,5° sul lato sinistro</li>
<li><strong>Luce di poppa (bianca)</strong>: visibile a 135° sul retro</li>
</ul>
<p>Schema mnemonico: <em>"Rosso = STOP = Sinistra = Pericolo"</em></p>
<ul>
<li>Vedo rosso + verde = imbarcazione di prua (rischio collisione)</li>
<li>Vedo solo rosso = incrocio da sinistra (ho la precedenza)</li>
<li>Vedo solo verde = incrocio da destra (devo cedere)</li>
<li>Vedo solo bianco = raggiungo un'altra imbarcazione da poppa</li>
</ul>`
      },
      {
        title: 'Segnali sonori',
        content: `<p>I segnali sonori in navigazione (un tratto breve = circa 1 secondo):</p>
<ul>
<li><strong>1 fischio breve</strong>: sto accostando a dritta</li>
<li><strong>2 fischi brevi</strong>: sto accostando a sinistra</li>
<li><strong>3 fischi brevi</strong>: sto andando indietro</li>
<li><strong>5+ fischi brevi</strong>: segnale di pericolo/dubbio</li>
</ul>
<p>In caso di scarsa visibilità (nebbia):</p>
<ul>
<li>Ogni 2 minuti: <strong>1 fischio lungo</strong> = nave a motore in navigazione</li>
<li>Ogni 2 minuti: <strong>2 fischi lunghi</strong> = nave a motore ferma</li>
<li>Ogni 2 minuti: <strong>1 lungo + 2 brevi</strong> = veliero, nave limitata in manovrabilità</li>
</ul>`
      },
      {
        title: 'Segnalamento marittimo',
        content: `<p>Il sistema di segnalamento IALA divide il mondo in due regioni:</p>
<ul>
<li><strong>Regione A</strong>: Europa, Africa, India, Australia</li>
<li><strong>Regione B</strong>: America, Giappone, Corea, Filippine</li>
</ul>
<p>In regione A (Italia):</p>
<ul>
<li><strong>Mede laterali di sinistra (rosso)</strong>: si lasciano a sinistra entrando in porto</li>
<li><strong>Mede laterali di dritta (verde)</strong>: si lasciano a dritta entrando in porto</li>
<li><strong>Mede di pericolo isolato (bianche/rosse a bande)</strong>: pericolo sommerso</li>
<li><strong>Mede di acque sicure (bianche/rosse a strisce verticali)</strong>: acque libere</li>
<li><strong>Mede cardinali (gialle/nere)</strong>: indicano il lato sicuro rispetto a un pericolo</li>
</ul>`
      }
    ]
  },
  {
    id: 'meteo',
    title: 'Meteorologia',
    icon: '🌤️',
    color: '#eab308',
    qRange: [846, 965],
    sections: [
      {
        title: 'Pressione atmosferica e vento',
        content: `<p>La <strong>pressione atmosferica</strong> si misura in millibar (mbar) o ettopascal (hPa). La pressione media al livello del mare è <strong>1013,25 hPa</strong>.</p>
<ul>
<li><strong>Alta pressione (anticiclone)</strong>: tempo stabile, bel tempo. Il vento ruota in senso orario nell'emisfero Nord.</li>
<li><strong>Bassa pressione (ciclone/depressione)</strong>: tempo perturbato, vento forte. Il vento ruota in senso antiorario nell'emisfero Nord.</li>
</ul>
<p>Le <strong>isobare</strong> sono linee che collegano punti di uguale pressione sulle carte meteorologiche. Più sono ravvicinate, più il vento è forte.</p>`
      },
      {
        title: 'Venti del Mediterraneo',
        content: `<p>I principali venti del Mediterraneo:</p>
<ul>
<li><strong>Tramontana</strong>: vento di Nord, freddo e secco</li>
<li><strong>Bora</strong>: vento di NE, freddo e violento (Adriatico)</li>
<li><strong>Maestrale (Mistral)</strong>: vento di NW, freddo e forte</li>
<li><strong>Scirocco</strong>: vento di SE, caldo e umido, porta polvere dal Sahara</li>
<li><strong>Libeccio</strong>: vento di SW, umido, porta perturbazioni</li>
<li><strong>Levante</strong>: vento di Est</li>
<li><strong>Ponente</strong>: vento di Ovest</li>
<li><strong>Ostro/Mezzogiorno</strong>: vento di Sud</li>
</ul>
<p>Il vento si nomina sempre dalla direzione da cui <strong>proviene</strong>.</p>`
      },
      {
        title: 'Scala Beaufort',
        content: `<p>La <strong>Scala Beaufort</strong> misura la forza del vento da 0 a 12:</p>
<ul>
<li><strong>0 - Calma</strong>: 0 kn, mare specchio</li>
<li><strong>1-3 - Brezza leggera</strong>: 1-10 kn, piccole increspature</li>
<li><strong>4 - Brezza moderata</strong>: 11-16 kn, onde piccole</li>
<li><strong>5 - Brezza tesa</strong>: 17-21 kn, onde moderate con creste</li>
<li><strong>6 - Vento fresco</strong>: 22-27 kn, onde grandi, cavalloni</li>
<li><strong>7 - Vento forte</strong>: 28-33 kn, mare molto agitato</li>
<li><strong>8 - Burrasca moderata</strong>: 34-40 kn, onde alte</li>
<li><strong>9-10 - Burrasca forte/violenta</strong>: 41-55 kn, mare tempestoso</li>
<li><strong>11-12 - Fortunale/Uragano</strong>: >55 kn, devastante</li>
</ul>`
      },
      {
        title: 'Previsioni e bollettini meteo',
        content: `<p>Prima di ogni uscita in mare è fondamentale consultare le previsioni meteorologiche:</p>
<ul>
<li><strong>Bollettino meteomarino</strong>: emesso dalla Protezione Civile e dall'Aeronautica Militare</li>
<li><strong>NAVTEX</strong>: sistema automatico di ricezione di avvisi di navigazione e meteo</li>
<li><strong>VHF canale 16</strong>: emergenze e comunicazioni portuali</li>
<li><strong>VHF canale 68</strong>: Marina Militare Italiana per meteo</li>
</ul>
<p>Segnali di peggioramento del tempo:</p>
<ul>
<li>Rapida caduta del barometro</li>
<li>Comparsa di cirri (nuvole alte e sottili)</li>
<li>Aureola intorno al sole o alla luna</li>
<li>Aumento repentino del vento</li>
<li>Mare "grasso" con lunghe ondulazioni senza vento</li>
</ul>`
      }
    ]
  },
  {
    id: 'cartografia',
    title: 'Cartografia Nautica',
    icon: '🗺️',
    color: '#3b82f6',
    qRange: [966, 1288],
    sections: [
      {
        title: 'Coordinate geografiche',
        content: `<p>La posizione sulla Terra si esprime con:</p>
<ul>
<li><strong>Latitudine</strong>: angolo tra il punto e l'equatore, da 0° a 90° N o S</li>
<li><strong>Longitudine</strong>: angolo tra il punto e il meridiano di Greenwich, da 0° a 180° E o O</li>
</ul>
<p>Un <strong>miglio nautico</strong> = 1852 metri = 1 primo d'arco di latitudine.</p>
<p>Un <strong>nodo</strong> = 1 miglio nautico all'ora.</p>
<p>Le coordinate si leggono in gradi (°), primi (') e secondi (") o decimali di primo.</p>
<p>La <strong>proiezione di Mercatore</strong> è quella usata nelle carte nautiche: i meridiani sono paralleli verticali e i paralleli sono orizzontali. Le rotte a angolo costante (rotte lossodromiche) appaiono come rette.</p>`
      },
      {
        title: 'Carte nautiche',
        content: `<p>Le carte nautiche contengono:</p>
<ul>
<li><strong>Batimetria</strong>: curve di uguale profondità (isobate) e quote dei fondali</li>
<li><strong>Toponimi</strong>: nomi di luoghi, porti, scogli</li>
<li><strong>Segnalamento marittimo</strong>: fari, boe, mede</li>
<li><strong>Pericoli alla navigazione</strong>: bassifondi, scogli, relitti</li>
<li><strong>Rosa dei venti/bussola</strong>: per orientamento</li>
</ul>
<p>Scala delle carte:</p>
<ul>
<li><strong>Carte generali</strong>: piccola scala (1:500.000+), visione d'insieme</li>
<li><strong>Carte costiere</strong>: scala media (1:100.000), navigazione costiera</li>
<li><strong>Carte di porto</strong>: grande scala (1:10.000 e più), ormeggio e manovra</li>
</ul>`
      },
      {
        title: 'Bussola e declinazione magnetica',
        content: `<p>La <strong>bussola magnetica</strong> punta al Nord magnetico, non al Nord geografico (vero).</p>
<ul>
<li><strong>Declinazione magnetica (d)</strong>: angolo tra Nord vero e Nord magnetico, varia per luogo e anno</li>
<li><strong>Deviazione (δ)</strong>: errore della bussola causato dal ferro dell'imbarcazione</li>
</ul>
<p>Correzioni:</p>
<ul>
<li>Nord vero = Nord bussola + deviazione + declinazione</li>
<li>Se la declinazione è Est (E), si aggiunge; se è Ovest (W), si sottrae</li>
</ul>
<p>Il <strong>rilevamento</strong> (bearing) è l'angolo che la direzione verso un oggetto fa con il Nord. Si usa per determinare la posizione.</p>`
      },
      {
        title: 'Navigazione stimata e carteggio',
        content: `<p>La <strong>navigazione stimata</strong> calcola la posizione futura partendo da posizione nota, rotta e velocità.</p>
<p>Elementi del carteggio:</p>
<ul>
<li><strong>Punto nave</strong>: posizione dell'imbarcazione sulla carta</li>
<li><strong>Rotta vera (Rv)</strong>: direzione di navigazione rispetto al Nord geografico</li>
<li><strong>Velocità (v)</strong>: in nodi (miglia/ora)</li>
<li><strong>Distanza (d)</strong>: d = v × t</li>
</ul>
<p>Il <strong>GPS</strong> (Global Positioning System) fornisce posizione in coordinate geografiche con alta precisione. Il <strong>Plotter GPS</strong> mostra la posizione su carta elettronica.</p>
<p>Le <strong>carte ENC</strong> (Electronic Navigational Charts) sono le carte ufficiali per la navigazione elettronica.</p>`
      },
      {
        title: 'Fari e segnalamenti luminosi',
        content: `<p>I <strong>fari</strong> sono caratterizzati da:</p>
<ul>
<li><strong>Portata luminosa</strong>: distanza a cui è visibile (in miglia nautiche)</li>
<li><strong>Periodo</strong>: tempo di un ciclo completo del lampeggio</li>
<li><strong>Caratteristica luminosa</strong>: tipo di luce (fissa, lampeggiante, a occultazioni...)</li>
</ul>
<p>Principali caratteristiche:</p>
<ul>
<li><strong>F</strong>: fissa (luce continua)</li>
<li><strong>Fl</strong>: a lampi (più buio che chiaro)</li>
<li><strong>Oc</strong>: a occultazioni (più chiaro che buio)</li>
<li><strong>Iso</strong>: isofase (chiaro e buio uguali)</li>
<li><strong>Q</strong>: a lampi rapidi (più di 60 lampi/min)</li>
<li><strong>Mo</strong>: codice Morse</li>
</ul>`
      }
    ]
  },
  {
    id: 'normativa',
    title: 'Normativa Diportistica',
    icon: '📋',
    color: '#a855f7',
    qRange: [1289, 1471],
    sections: [
      {
        title: 'Patente nautica: categorie e requisiti',
        content: `<p>La <strong>patente nautica</strong> in Italia è disciplinata dal D.Lgs. 171/2005 (Codice della Nautica da Diporto).</p>
<p>Categorie:</p>
<ul>
<li><strong>Categoria A</strong>: motore e vela, senza limiti dalla costa</li>
<li><strong>Categoria B/C</strong>: navigazione costiera (entro 12 miglia)</li>
</ul>
<p>Requisiti minimi:</p>
<ul>
<li>Età minima: <strong>16 anni</strong> (con limiti di potenza), <strong>18 anni</strong> per patente piena</li>
<li>Idoneità fisica: visita medica</li>
<li>Superamento dell'esame teorico e pratico</li>
</ul>
<p>Non è richiesta la patente per imbarcazioni con motore ≤ 30 kW (40,8 CV) entro 6 miglia, se si è maggiorenni.</p>`
      },
      {
        title: 'Documenti di bordo',
        content: `<p>I documenti obbligatori a bordo:</p>
<ul>
<li><strong>Licenza di navigazione</strong>: documento che abilita la navigazione dell'imbarcazione</li>
<li><strong>Certificato di stazza</strong>: attesta le dimensioni dell'imbarcazione</li>
<li><strong>Assicurazione RCA</strong>: obbligatoria per le imbarcazioni a motore</li>
<li><strong>Patente nautica del conduttore</strong> (se richiesta)</li>
<li><strong>Certificato di idoneità alla navigazione</strong>: per imbarcazioni sopra certe dimensioni</li>
<li><strong>Bolletta doganale</strong>: per navigazione fuori dall'UE</li>
</ul>
<p>La <strong>licenza di navigazione</strong> specifica la categoria di navigazione consentita e deve essere sempre a bordo.</p>`
      },
      {
        title: 'Limiti di velocità e norme di comportamento',
        content: `<p>Limiti di velocità nelle acque italiane:</p>
<ul>
<li><strong>3 nodi</strong>: entro 200 metri dalla costa (aree con bagnanti) e nelle aree portuali</li>
<li><strong>5 nodi</strong>: nelle zone di balneazione segnalate</li>
<li><strong>10 nodi</strong>: entro 1 miglio dalla costa in alcune zone</li>
</ul>
<p>Norme importanti:</p>
<ul>
<li><strong>Alcool</strong>: limite di 0,5 g/l di alcool nel sangue (come per auto). Oltre 1,5 g/l: arresto</li>
<li><strong>Droghe</strong>: vietato condurre sotto effetto di stupefacenti</li>
<li><strong>Sci nautico</strong>: vietato entro 300 metri dalla costa; richiede persona a bordo in aggiunta al pilota</li>
</ul>`
      },
      {
        title: 'Aree marine protette e ZTL',
        content: `<p>Le <strong>Aree Marine Protette (AMP)</strong> sono zone di tutela dell'ecosistema marino:</p>
<ul>
<li><strong>Zona A</strong>: riserva integrale, accesso limitatissimo</li>
<li><strong>Zona B</strong>: riserva generale, navigazione con limiti</li>
<li><strong>Zona C</strong>: riserva parziale, alcune attività consentite</li>
</ul>
<p>Nelle AMP è generalmente vietato:</p>
<ul>
<li>Ancorare fuori dai campi boe</li>
<li>Pesca subacquea e professionale</li>
<li>Immersioni senza autorizzazione</li>
<li>Navigazione a velocità elevata</li>
</ul>
<p>Le <strong>acque interne</strong> (laghi, fiumi, canali) hanno normativa specifica del Codice della Navigazione interna.</p>`
      }
    ]
  }
];

// Exam configuration: how many questions per range for official exam simulation
const EXAM_CONFIG = [
  { from: 1,    to: 125,  count: 1, label: 'Scafo' },
  { from: 126,  to: 229,  count: 1, label: 'Motori' },
  { from: 230,  to: 444,  count: 3, label: 'Sicurezza' },
  { from: 445,  to: 598,  count: 4, label: 'Navigazione' },
  { from: 599,  to: 845,  count: 2, label: 'COLREG' },
  { from: 846,  to: 965,  count: 2, label: 'Meteorologia' },
  { from: 966,  to: 1288, count: 4, label: 'Cartografia' },
  { from: 1289, to: 1471, count: 3, label: 'Normativa' },
];
