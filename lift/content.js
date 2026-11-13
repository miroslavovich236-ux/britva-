// Все тексты сайта и ракурсы камеры — здесь.
//
// Ракурс (view): yaw — поворот машины (градусы), elev — высота камеры (градусы),
// dist — дальность (1 = машина целиком), target — куда смотрит камера (координаты модели),
// shift — сдвиг машины по экрану [вправо, вниз] в долях экрана, exposure — яркость сцены.
// mview — те же параметры для телефона (переопределяют view).
//
// Выноска (label): dir 1 — табличка справа от детали, −1 — слева;
// rise 1 — линия идёт вверх, −1 — вниз; dx/dy — длина линии в пикселях.
// mini — подпись на общем виде (на телефоне там показываются только номера).

export const SITE = {
  title: ['Подъёмная', 'сила'],
  eyebrow: 'Интерактивная выставка',
  lead: 'Вертолёт и самолёт: две машины и два способа удержаться в воздухе.',
  cue: 'Листайте вниз',
  outro: {
    title: 'Подъёмная сила',
    text: 'Винт или крыло, физика одна: машина толкает воздух вниз, а воздух толкает её вверх.',
    button: 'Смотреть с начала',
    note: 'Демонстрационный проект: модели и характеристики вымышлены.',
  },
};

export const VEHICLES = {
  heli: {
    num: '01', kind: 'Вертолёт', name: 'AERIS H7',
    lead: 'Подъёмную силу создаёт несущий винт. Лопасти вращаются, и машина может висеть на месте.',
    parts: [
      {
        num: '01', tag: 'Кабина', title: 'Панорамная кабина',
        text: 'Остекление на 220° и окно у ног пилота: площадку видно прямо во время посадки.',
        stats: [['220°', 'обзор'], ['1 + 6', 'мест']],
        anchor: 'cockpit', overview: 'cockpitStbd',
        label: { dir: 1, rise: 1, dx: 150, dy: 60 }, mini: { dir: 1, rise: 1 },
      },
      {
        num: '02', tag: 'Несущий винт', title: 'Несущий винт',
        text: 'Четыре композитные лопасти на бесшарнирной втулке. Меньше вибраций в салоне и тише над городом.',
        stats: [['10,8 м', 'диаметр'], ['395', 'об/мин']],
        anchor: 'rotor', overview: 'rotor',
        label: { dir: 1, rise: 1, dx: 120, dy: 70 }, mini: { dir: -1, rise: 1, dy: 46 },
      },
      {
        num: '03', tag: 'Двигатель', title: 'Турбовальный двигатель',
        text: '1 000 л.с. и цифровое управление FADEC. Запуск одной кнопкой, режимы держит автоматика.',
        stats: [['746 кВт', 'взлётная мощность'], ['3 500 ч', 'до переборки']],
        anchor: 'engine', overview: 'engineStbd',
        label: { dir: 1, rise: 1, dx: 110, dy: 120 }, mini: { dir: 1, rise: 1, dy: 26 },
      },
      {
        num: '04', tag: 'Рулевой винт', title: 'Рулевой винт',
        text: 'Гасит реактивный момент несущего винта и разворачивает машину на месте, как сейчас на экране.',
        stats: [['1,9 м', 'диаметр'], ['2 050', 'об/мин']],
        anchor: 'tail', overview: 'tailStbd',
        label: { dir: 1, rise: 1, dx: 90, dy: 150 }, mini: { dir: -1, rise: 1 },
      },
      {
        num: '05', tag: 'Хвостовая балка', title: 'Балка и стабилизатор',
        text: 'Углепластиковая балка легче алюминиевой на 18 %. Стабилизатор с шайбами держит курс на крейсерской скорости.',
        stats: [['−18 %', 'массы'], ['250 км/ч', 'крейсерская']],
        anchor: 'boom', overview: 'boom',
        label: { dir: 1, rise: 1, dx: 110, dy: 90 }, mini: { dir: -1, rise: -1 },
      },
      {
        num: '06', tag: 'Шасси', title: 'Полозковое шасси',
        text: 'Поперечные балки гасят удар при жёсткой посадке. Садится на снег, траву и неподготовленные площадки.',
        stats: [['1,7 м', 'колея'], ['Опция', 'аварийные поплавки']],
        anchor: 'skids', overview: 'skidsMid',
        label: { dir: 1, rise: -1, dx: 110, dy: 70 }, mini: { dir: 1, rise: -1 },
      },
    ],
    specs: [
      ['287', 'км/ч', 'макс. скорость'],
      ['650', 'км', 'дальность'],
      ['6 000', 'м', 'потолок'],
      ['2 800', 'кг', 'взлётная масса'],
      ['1 200', 'кг', 'нагрузка'],
      ['6', 'чел.', 'пассажиров'],
    ],
  },

  plane: {
    num: '02', kind: 'Бизнес-джет', name: 'AERIS J9',
    lead: 'Подъёмную силу создаёт крыло. Самолёт разгоняется, и встречный поток поднимает его.',
    parts: [
      {
        num: '01', tag: 'Кабина', title: 'Кабина пилотов',
        text: 'Два пилота и четыре больших дисплея. Синтетическое зрение рисует рельеф и полосу даже в тумане.',
        stats: [['4 × 14″', 'дисплеи'], ['2', 'пилота']],
        anchor: 'cockpit', overview: 'cockpitStbd',
        label: { dir: 1, rise: 1, dx: 150, dy: 70 }, mini: { dir: 1, rise: 1 },
      },
      {
        num: '02', tag: 'Крыло', title: 'Стреловидное крыло',
        text: 'Стреловидность 29° и загнутые законцовки снижают сопротивление. Почти вся подъёмная сила рождается здесь.',
        stats: [['19,4 м', 'размах'], ['29°', 'стреловидность']],
        anchor: 'wing', overview: 'wingStbd',
        label: { dir: 1, rise: 1, dx: 90, dy: 110 }, mini: { dir: -1, rise: 1, dy: 40 },
      },
      {
        num: '03', tag: 'Салон', title: 'Салон',
        text: 'Девять метров длины и 1,9 м высоты. В салоне давление как на высоте 1 500 м, поэтому после перелёта не устаёшь.',
        stats: [['12', 'пассажиров'], ['1 500 м', 'высота в салоне']],
        anchor: 'cabin', overview: 'cabinStbd',
        label: { dir: 1, rise: 1, dx: 110, dy: 130 }, mini: { dir: -1, rise: -1, dy: 40 },
      },
      {
        num: '04', tag: 'Двигатели', title: 'Двигатели',
        text: 'Два турбовентиляторных двигателя на хвостовой части: в салоне тише, а крыло остаётся чистым.',
        stats: [['2 × 32 кН', 'взлётная тяга'], ['−6 дБ', 'шум в салоне']],
        anchor: 'engine', overview: 'engineStbd',
        label: { dir: 1, rise: 1, dx: 110, dy: 110 }, mini: { dir: 1, rise: 1, dy: 30 },
      },
      {
        num: '05', tag: 'Оперение', title: 'Т-образное оперение',
        text: 'Стабилизатор поднят на вершину киля, подальше от струи двигателей. Руль высоты работает в чистом потоке.',
        stats: [['6,7 м', 'высота'], ['6,8 м', 'размах стабилизатора']],
        anchor: 'tail', overview: 'tailStbd',
        label: { dir: 1, rise: 1, dx: 100, dy: 80 }, mini: { dir: -1, rise: 1 },
      },
      {
        num: '06', tag: 'Шасси', title: 'Шасси',
        text: 'Трёхопорное шасси со спаренными колёсами. Короткий пробег: хватает полосы длиной 1 200 м.',
        stats: [['1 200 м', 'посадочная дистанция'], ['6', 'колёс']],
        anchor: 'gear', overview: 'gearStbd',
        label: { dir: 1, rise: -1, dx: 110, dy: 80 }, mini: { dir: 1, rise: -1 },
      },
    ],
    specs: [
      ['950', 'км/ч', 'крейсерская'],
      ['7 400', 'км', 'дальность'],
      ['15 500', 'м', 'потолок'],
      ['21,9', 'м', 'длина'],
      ['18 600', 'кг', 'взлётная масса'],
      ['12', 'чел.', 'пассажиров'],
    ],
  },
};

// Шаги прокрутки: 1 шаг = 1 экран. Порядок деталей совпадает с parts.
export const STEPS = [
  { kind: 'intro', subject: 'heli',
    view: { yaw: -15, elev: 6, dist: 1.2, target: [-1.5, 0.35, 0], shift: [0, 0.2], exposure: 0.16 },
    mview: { dist: 0.95, shift: [0, 0.1] } },
  { kind: 'chapter', subject: 'heli',
    view: { yaw: -35, elev: 13, dist: 1.0, target: [-1.5, 0.35, 0], shift: [0.12, -0.08] },
    mview: { dist: 0.8, shift: [0, -0.15] } },
  { kind: 'part', subject: 'heli', part: 0,
    view: { yaw: -58, elev: 10, dist: 0.52, target: [1.1, 0.2, 0], shift: [-0.18, 0.06] },
    mview: { yaw: -66, dist: 0.55, shift: [0, -0.16] } },
  { kind: 'part', subject: 'heli', part: 1,
    view: { yaw: -118, elev: 38, dist: 0.95, target: [0.15, 1.3, 0], shift: [-0.12, 0.08] },
    mview: { dist: 1.0, shift: [0, -0.08] } },
  { kind: 'part', subject: 'heli', part: 2,
    view: { yaw: -168, elev: 17, dist: 0.7, target: [-0.9, 0.75, 0], shift: [-0.14, 0.1] },
    mview: { dist: 0.62, shift: [0, -0.14] } },
  { kind: 'part', subject: 'heli', part: 3,
    view: { yaw: -205, elev: 12, dist: 0.52, target: [-5.7, 0.9, -0.1], shift: [-0.12, 0.1] },
    mview: { dist: 0.55, shift: [0, -0.14] } },
  { kind: 'part', subject: 'heli', part: 4,
    view: { yaw: -268, elev: 22, dist: 0.7, target: [-4.4, 0.6, 0], shift: [-0.12, 0.06] },
    mview: { dist: 0.75, shift: [0, -0.14] } },
  { kind: 'part', subject: 'heli', part: 5,
    view: { yaw: -328, elev: 6, dist: 0.7, target: [0.0, -0.8, 0], shift: [-0.12, -0.06] },
    mview: { dist: 0.75, shift: [0, -0.2] } },
  { kind: 'specs', subject: 'heli',
    view: { yaw: -395, elev: 16, dist: 1.05, target: [-1.5, 0.3, 0], shift: [0, -0.1] },
    mview: { dist: 0.95, shift: [0, -0.2] } },

  { kind: 'chapter', subject: 'plane',
    view: { yaw: -30, elev: 12, dist: 1.0, target: [-0.5, 0.8, 0], shift: [0.12, -0.08] },
    mview: { dist: 0.9, shift: [0, -0.15] } },
  { kind: 'part', subject: 'plane', part: 0,
    view: { yaw: -58, elev: 8, dist: 0.36, target: [7.6, 0.2, 0], shift: [-0.16, 0.06] },
    mview: { dist: 0.42, shift: [0, -0.16] } },
  { kind: 'part', subject: 'plane', part: 1,
    view: { yaw: -125, elev: 34, dist: 0.62, target: [-1.0, 0.0, -5.0], shift: [-0.16, 0.08] },
    mview: { dist: 0.7, shift: [0, -0.12] } },
  { kind: 'part', subject: 'plane', part: 2,
    view: { yaw: -178, elev: 10, dist: 0.5, target: [1.0, 0.3, 0], shift: [-0.06, 0.14] },
    mview: { dist: 0.55, shift: [0, -0.14] } },
  { kind: 'part', subject: 'plane', part: 3,
    view: { yaw: -218, elev: 14, dist: 0.42, target: [-6.0, 0.8, -1.6], shift: [-0.14, 0.08] },
    mview: { dist: 0.48, shift: [0, -0.14] } },
  { kind: 'part', subject: 'plane', part: 4,
    view: { yaw: -268, elev: 18, dist: 0.5, target: [-10.2, 2.6, 0], shift: [-0.14, 0.04] },
    mview: { dist: 0.55, shift: [0, -0.14] } },
  { kind: 'part', subject: 'plane', part: 5,
    view: { yaw: -326, elev: 4, dist: 0.42, target: [-0.5, -1.4, 1.2], shift: [-0.14, -0.04] },
    mview: { dist: 0.5, shift: [0, -0.2] } },
  { kind: 'specs', subject: 'plane',
    view: { yaw: -390, elev: 16, dist: 1.0, target: [-0.5, 0.8, 0], shift: [0, -0.1] },
    mview: { dist: 0.92, shift: [0, -0.2] } },
  { kind: 'outro', subject: 'plane',
    view: { yaw: -412, elev: 24, dist: 1.35, target: [-0.5, 0.6, 0], shift: [0, 0.3], exposure: 0.14 },
    mview: { dist: 1.1, shift: [0, 0.3] } },
];
