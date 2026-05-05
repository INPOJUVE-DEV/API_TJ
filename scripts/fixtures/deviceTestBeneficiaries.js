const SERVICE_POINT_FIXTURES = [
  {
    pointName: 'Oficina Central del Instituto Potosino de la Juventud',
    region: 'Centro',
    delegacion: 'Oficina Central',
    municipio: 'San Luis Potosi',
    direccion: 'Salvador Nava #50 Col. El Paseo',
    mapsUrl: 'https://share.google/JGV6QLerSEMYW9m2z',
    horario: '8 am - 4 pm',
    email: 'tramite.oficina-central.slp@example.com',
    password: 'CentroTJ#2026!',
    tarjetaNumero: 'TJ-2001'
  },
  {
    pointName: 'IMJUVE Villa de Pozos',
    region: 'Centro',
    delegacion: 'Villa de Pozos',
    municipio: 'Villa de Pozos',
    direccion: 'Calle 71 #299-A, Prados Segunda',
    mapsUrl: 'https://maps.app.goo.gl/bMePGzuH7mxXKAjX8',
    horario: '9:00 AM - 4:00 PM',
    email: 'tramite.villa-de-pozos@example.com',
    password: 'PozosTJ#2026!',
    tarjetaNumero: 'TJ-2002'
  },
  {
    pointName: 'IMJUVE Soledad de Graciano Sanchez',
    region: 'Centro',
    delegacion: 'Soledad de Graciano Sanchez',
    municipio: 'Soledad de Graciano Sanchez',
    direccion: 'Av. Bellavista #1049, Villas de San Lorenzo',
    mapsUrl: 'https://maps.app.goo.gl/nGztKGGFWSQ3YG3v8?g_st=iw',
    horario: '8:00 - 16:00',
    email: 'tramite.soledad@example.com',
    password: 'SoledadTJ#2026!',
    tarjetaNumero: 'TJ-2003'
  },
  {
    pointName: 'Delegacion INPOJUVE Region Altiplano',
    region: 'Altiplano',
    delegacion: 'Altiplano Norte',
    municipio: 'Matehuala',
    direccion:
      'Campo Betania, Carr. a La Paz Km. 1, Infonavit Fidel Velazquez, 78720 Matehuala, S.L.P.',
    mapsUrl: 'https://maps.app.goo.gl/7HiU5c1cxGeb93dN8?g_st=ic',
    horario: '8 am - 4 pm',
    email: 'tramite.altiplano.matehuala@example.com',
    password: 'AltiplanoTJ#2026!',
    tarjetaNumero: 'TJ-2004'
  },
  {
    pointName: 'Delegacion INPOJUVE Region Media',
    region: 'Media',
    delegacion: 'Region Media',
    municipio: 'Rioverde',
    direccion: 'Antonio Quesada Oriente 115',
    mapsUrl: 'https://maps.app.goo.gl/R3BpwECkw4F8oAwb8?g_st=iw',
    horario: '8 am - 3 pm',
    email: 'tramite.region-media.rioverde@example.com',
    password: 'MediaTJ#2026!',
    tarjetaNumero: 'TJ-2005'
  },
  {
    pointName: 'Delegacion INPOJUVE Huasteca Norte',
    region: 'Huasteca',
    delegacion: 'Huasteca Norte',
    municipio: 'Ciudad Valles',
    direccion: 'C. Morelos 104, Zona Centro, Ciudad Valles, S.L.P.',
    mapsUrl: 'https://maps.app.goo.gl/8dfSp3Fy64site1d8?g_st=ic',
    horario: '8 am - 4 pm',
    email: 'tramite.huasteca-norte.valles@example.com',
    password: 'HuastecaNorteTJ#2026!',
    tarjetaNumero: 'TJ-2006'
  },
  {
    pointName: 'Delegacion INPOJUVE Huasteca Centro',
    region: 'Huasteca',
    delegacion: 'Huasteca Centro',
    municipio: 'Tancanhuitz',
    direccion: null,
    mapsUrl: null,
    horario: null,
    email: 'tramite.huasteca-centro.tancanhuitz@example.com',
    password: 'HuastecaCentroTJ#2026!',
    tarjetaNumero: 'TJ-2007'
  }
];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function buildCurp(index) {
  return `PAAA900101HSPBCD${pad2(index)}`;
}

function buildTelefono(index) {
  return `444220${String(index).padStart(4, '0')}`;
}

function buildDeviceTestFixtures(options = {}) {
  const passwordOverride = options.passwordOverride || null;

  return SERVICE_POINT_FIXTURES.map((fixture, arrayIndex) => {
    const index = arrayIndex + 1;
    const nombre = `Prueba ${fixture.delegacion}`;
    const apellidos = fixture.region;
    const curp = buildCurp(index);
    const password = passwordOverride || fixture.password;

    return {
      pointName: fixture.pointName,
      region: fixture.region,
      delegacion: fixture.delegacion,
      direccion: fixture.direccion,
      mapsUrl: fixture.mapsUrl,
      horario: fixture.horario,
      user: {
        nombre,
        apellidos,
        curp,
        email: fixture.email,
        telefono: buildTelefono(index),
        municipio: fixture.municipio,
        password,
        role: 'beneficiary'
      },
      cardholder: {
        curp,
        nombres: nombre,
        apellidos,
        municipio: fixture.municipio,
        tarjeta: fixture.tarjetaNumero,
        tarjetaNumero: fixture.tarjetaNumero,
        status: 'active',
        linkToUserEmail: fixture.email
      }
    };
  });
}

module.exports = {
  buildDeviceTestFixtures
};
