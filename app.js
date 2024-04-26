const bodyParser = require('body-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Expo } = require('expo-server-sdk');
const express = require('express');
const Multer = require('multer');
const path = require('path');
//const moment = require('moment');
const moment = require('moment-timezone');

const expo = new Expo();
const cron = require('node-cron');

// Establece la zona horaria para México
moment.tz.setDefault('America/Mexico_City');

//GOOGLE CLOUD
const { Storage } = require('@google-cloud/storage');
const { title } = require('process');

// Configura Google Cloud Storage
const storage = new Storage({
    projectId: 'certain-router-414905',
    keyFilename: path.join(__dirname, 'cloud', 'certain-router-414905-f384a959b654.json')
});

const bucket_name = 'gym-app-fotos'

const bucket = storage.bucket(bucket_name);
// Configura Multer para subir los archivos a la memoria como Buffer
const multer = Multer({
    storage: Multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // no larger than 5mb
    },
});

//Conección a la base de datos de postgresql
const pgp = require('pg-promise')();
const db = pgp(
    process.env.DB_URL ??
    'postgres://fl0user:6xlCBe8qOZEs@ep-wandering-snow-a55ot4r0.us-east-2.aws.neon.fl0.io:5432/gym-db?sslmode=require'
);

const app = express();
const port = process.env.PORT ?? 3001;
let version = process.env.VERSION ?? '1.1';
let url_descarga = process.env.URL_VERSION ?? 'https://storage.googleapis.com/gym-app-fotos/Nuevo_Version/Gym%20App%201.2.0.apk';

app.use(bodyParser.json());

app.set('view engine', 'ejs'); //Para leer archivos html en el backend
app.use(express.static('public')) //para que las rutas sean publicas
app.use('/storage', express.static(path.join(__dirname, 'storage'))); //Para definir la carpeta


// SET TIME ZONE 'America/Mexico_City';
app.post('/login', (req, res) => {
    const { s_usuario, s_password } = req.body;

    db.one(`SELECT 
            cl.*,
            ce.sk_estatus AS sk_estatus_empresa,
            ce.s_nombre_empresa,
            ce.i_administrador,
            ce.s_color_primario,
            ce.s_color_secundario
            FROM cat_licencias cl
            INNER JOIN cat_empresas ce ON ce.sk_empresa = cl.sk_empresa
            WHERE cl.s_usuario = $1
            AND cl.s_password = $2`,
        [s_usuario, s_password])
        .then((response) => {
            res.status(200).json({ data: response, message: 'Credenciales correctas', status: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Credenciales incorrectas', status: false });
        });
});

app.post('/obtenerVersion', (req, res) => {
    res.status(200).json({
        data: {
            version,
            url_descarga
        }, message: 'Version', status: true
    });
});

/* ******************************* NEGOCIOS ************************************* */

app.post('/nuevo_negocio', (req, res, next) => {

    const {
        s_nombre_empresa,
    } = req.body;

    let sk_empresa = uuidv4();
    db.none(`
     
      
      INSERT INTO cat_empresas
      (
          sk_empresa,
          d_fecha_creacion,
          sk_estatus,
          i_administrador,
          s_nombre_empresa,
          s_color_primario,
          s_color_secundario
      ) VALUES (
          $1,
          CURRENT_TIMESTAMP,
          $2,
          $3,
          $4,
          $5,
          $6
      )`, [sk_empresa, 'AC', 0, s_nombre_empresa, s_color_primario, s_color_secundario])
        .then((data) => {
            console.log(data)
            res.status(200).json({ message: 'Negocio insertado correctamente', status: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al insertar el negocio', status: false });
        });



});

app.post('/editar_negocio', (req, res, next) => {

    const {
        sk_empresa,
        s_nombre_empresa,
        s_color_primario,
        s_color_secundario
    } = req.body;

    db.none(`
    UPDATE cat_empresas SET 
    s_nombre_empresa = $1,
    s_color_primario = $2,
    s_color_secundario = $3
    WHERE sk_empresa = $4`, [s_nombre_empresa, s_color_primario, s_color_secundario, sk_empresa])
        .then((data) => {
            console.log(data)
            res.status(200).json({ message: 'Negocio editado correctamente', status: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al editar el negocio', status: false });
        });



});

app.post('/nueva_licencia', (req, res, next) => {

    const {
        s_nombre,
        s_usuario,
        s_password,
        sk_empresa,
    } = req.body;

    if (req.body.sk_licencia) {
        let sk_licencia = req.body.sk_licencia;
        db.none(`
            UPDATE cat_licencias SET
    s_nombre = $1,
        s_usuario = $2,
        s_password = $3
            WHERE sk_licencia = $4`,
            [s_nombre, s_usuario, s_password, sk_licencia])
            .then((data) => {
                console.log(data)
                res.status(200).json({ message: 'Licencia modificada correctamente', status: true });
            })
            .catch((error) => {
                console.error('Error:', error);
                res.status(500).json({ message: 'Hubo un error al modificar la licencia.', status: false });
            });

    } else {

        let sk_licencia = uuidv4();
        db.none(`
         
          
          INSERT INTO cat_licencias
        (
            sk_licencia,
            sk_estatus,
            s_usuario,
            s_password,
            d_fecha_creacion,
            sk_empresa,
            s_nombre
        ) VALUES(
            $1,
            $2,
            $3,
            $4,
            CURRENT_TIMESTAMP,
            $5,
            $6
        )`, [sk_licencia, 'AC', s_usuario, s_password, sk_empresa, s_nombre])
            .then((data) => {
                console.log(data)
                res.status(200).json({ message: 'Licencia creada correctamente', status: true });
            })
            .catch((error) => {
                console.error('Error:', error);
                res.status(500).json({ message: 'Hubo un error al crear la licencia.', status: false });
            });
    }

});

app.post('/eliminar_licencia', (req, res) => {

    const { sk_licencia } = req.body;

    db.none(`DELETE FROM cat_licencias WHERE sk_licencia = $1`, [sk_licencia])
        .then(() => {
            res.status(200).json({ message: 'Licencia eliminada correctamente', status: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al eliminar la licencia', status: false });
        });
});

/* ******************************* CLIENTES ************************************* */

app.get('/obtenerClientes', (req, res) => {
    db.any(`SELECT * FROM cat_empresas WHERE i_administrador = 0 ORDER BY s_nombre_empresa ASC `)
        .then((data) => {
            res.json(data)
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al agregar el usuario', status: false });
        });
})

app.post('/obtenerLicencias', (req, res) => {

    const {
        sk_empresa
    } = req.body

    db.any(`SELECT * FROM cat_licencias WHERE sk_empresa = $1`, [sk_empresa])
        .then((data) => {
            res.json(data)
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al agregar el usuario', status: false });
        });
})

app.post('/cambiarEstatusCliente', (req, res) => {

    const {
        sk_estatus,
        sk_empresa
    } = req.body;

    db.none('UPDATE cat_empresas SET sk_estatus = $1 WHERE sk_empresa = $2', [sk_estatus, sk_empresa])
        .then(() => {
            res.status(200).json({ message: 'Se modifico el estatus del cliente correctamente.', status: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al modificar el estatus del cliente', status: false });
        });
});

app.post('/cambiarEstatusLicencia', (req, res) => {

    const {
        sk_estatus,
        sk_licencia
    } = req.body;

    db.none('UPDATE cat_licencias SET sk_estatus = $1 WHERE sk_licencia = $2', [sk_estatus, sk_licencia])
        .then(() => {
            res.status(200).json({ message: 'Se modifico el estatus de la licencia del cliente correctamente.', estatus: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al modificar el estatus de la licencia', estatus: false });
        });
});

/* ******************************* USUARIOS ************************************* */

app.post('/nuevo_usuario', multer.single('photo'), (req, res, next) => {
    if (req.file) {
        // Crea un nuevo blob en el bucket y sube los datos del archivo
        const sk_empresa_carpeta = req.body.sk_empresa;
        const blob = bucket.file(`${sk_empresa_carpeta} /${req.file.originalname}`);
        const blobStream = blob.createWriteStream();

        blobStream.on('error', err => {
            next(err);
        });

        blobStream.on('finish', () => {
            // La URL pública se puede usar para acceder al archivo directamente a través de HTTP
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

            const {
                s_nombre,
                s_apellido_paterno,
                s_apellido_materno,
                s_telefono,
                f_mensualidad,
                d_fecha_nacimiento,
                d_fecha_inscripcion,
                sk_empresa
            } = req.body;

            const s_foto = publicUrl; // Usamos la URL pública de la imagen
            let sk_usuario = uuidv4();
            db.none(`
              SET TIME ZONE 'America/Mexico_City';
              INSERT INTO cat_usuarios
              (
                  sk_usuario,
                  s_nombre,
                  s_apellido_paterno,
                  s_apellido_materno,
                  s_telefono,
                  s_foto,
                  d_fecha_nacimiento,
                  d_fecha_inscripcion,
                  sk_estatus,
                  sk_empresa,
                  d_fecha_creacion,
                  f_mensualidad
              ) VALUES (
                  $1,
                  $2,
                  $3,
                  $4,
                  $5,
                  $6,
                  TO_DATE($7, \'DD/MM/YYYY\'),
                  TO_DATE($8, \'DD/MM/YYYY\'),
                  $9,
                  $10,
                  CURRENT_TIMESTAMP,
                  $11
              )`, [sk_usuario, s_nombre, s_apellido_paterno, s_apellido_materno, s_telefono, s_foto, d_fecha_nacimiento, d_fecha_inscripcion, 'AC', sk_empresa, f_mensualidad])
                .then((data) => {
                    /* SE REGISTRARÄ UNA NUEVA RENOVACIÓN DE USUARIO */
                    let sk_renovacion = uuidv4();
                    db.none(`
                    SET TIME ZONE 'America/Mexico_City';
                    INSERT INTO rel_usuarios_renovaciones
                    (sk_renovacion, sk_usuario, d_fecha_renovacion, f_mensualidad,i_renovacion)
                    VALUES ($1, $2, CURRENT_TIMESTAMP, $3, 0)`,
                        [sk_renovacion, sk_usuario, f_mensualidad]
                    ).then((data) => {
                        res.status(200).json({ message: 'Usuario insertado correctamente', status: true });
                    }).catch((error) => {
                        console.error('Error:', error);
                        res.status(500).json({ message: 'Hubo un error al insertar el usuario', status: false });
                    });
                })
                .catch((error) => {
                    console.error('Error:', error);
                    res.status(500).json({ message: 'Hubo un error al insertar el usuario', status: false });
                });
        });

        blobStream.end(req.file.buffer);
    } else {
        const {
            s_nombre,
            s_apellido_paterno,
            s_apellido_materno,
            s_telefono,
            f_mensualidad,
            d_fecha_nacimiento,
            d_fecha_inscripcion,
            sk_empresa
        } = req.body;

        const s_foto = null; // Usamos la URL pública de la imagen
        let sk_usuario = uuidv4();
        db.none(`
        SET TIME ZONE 'America/Mexico_City';
          
          INSERT INTO cat_usuarios
          (
              sk_usuario,
              s_nombre,
              s_apellido_paterno,
              s_apellido_materno,
              s_telefono,
              s_foto,
              d_fecha_nacimiento,
              d_fecha_inscripcion,
              sk_estatus,
              sk_empresa,
              d_fecha_creacion,
              f_mensualidad
          ) VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              TO_DATE($7, \'DD/MM/YYYY\'),
              TO_DATE($8, \'DD/MM/YYYY\'),
              $9,
              $10,
              CURRENT_TIMESTAMP,
              $11
          )`, [sk_usuario, s_nombre, s_apellido_paterno, s_apellido_materno, s_telefono, s_foto, d_fecha_nacimiento, d_fecha_inscripcion, 'AC', sk_empresa, f_mensualidad]
        ).then((data) => {
            /* SE REGISTRARÄ UNA NUEVA RENOVACIÓN DE USUARIO */
            let sk_renovacion = uuidv4();
            db.none(`
                SET TIME ZONE 'America/Mexico_City';
                INSERT INTO rel_usuarios_renovaciones
                (sk_renovacion, sk_usuario, d_fecha_renovacion, f_mensualidad,i_renovacion)
                VALUES ($1, $2, CURRENT_TIMESTAMP, $3, 0)`,
                [sk_renovacion, sk_usuario, f_mensualidad]
            ).then((data) => {
                res.status(200).json({ message: 'Usuario insertado correctamente', status: true });
            }).catch((error) => {
                console.error('Error:', error);
                res.status(500).json({ message: 'Hubo un error al insertar el usuario', status: false });
            });

        }).catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al insertar el usuario', status: false });
        });
    }



});

app.post('/editar_usuario', multer.single('photo'), (req, res, next) => {
    const {
        sk_usuario,
        s_nombre,
        s_apellido_paterno,
        s_apellido_materno,
        s_telefono,
        d_fecha_nacimiento,
    } = req.body;

    //en caso de que tenga imagen
    if (req.file) {
        // Crea un nuevo blob en el bucket y sube los datos del archivo
        const sk_empresa_carpeta = req.body.sk_empresa;
        const blob = bucket.file(`${sk_empresa_carpeta}/${req.file.originalname}`);
        //const blob = bucket.file(req.file.originalname);
        const blobStream = blob.createWriteStream();

        blobStream.on('error', err => {
            next(err);
        });

        blobStream.on('finish', () => {
            // La URL pública se puede usar para acceder al archivo directamente a través de HTTP
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

            const s_foto = publicUrl; // Usamos la URL pública de la imagen

            db.none(`

         
          UPDATE cat_usuarios SET
          s_nombre = '${s_nombre}',
          s_apellido_paterno = '${s_apellido_paterno}',
          s_apellido_materno = '${s_apellido_materno}',
          s_telefono = '${s_telefono}',
          s_foto = '${s_foto}',
          d_fecha_nacimiento = TO_DATE('${d_fecha_nacimiento}', \'DD/MM/YYYY\')
          WHERE sk_usuario = '${sk_usuario}'`)
                .then(() => {
                    res.status(200).json({ message: 'Usuario modificado correctamente', status: true });
                })
                .catch((error) => {
                    console.error('Error:', error);
                    res.status(500).json({ message: 'Hubo un error al modificar el usuario', status: false });
                });
        });

        blobStream.end(req.file.buffer);

    } else {
        //En caso de que no tenga imagen
        db.none(`
        UPDATE cat_usuarios SET
        s_nombre = '${s_nombre}',
        s_apellido_paterno = '${s_apellido_paterno}',
        s_apellido_materno = '${s_apellido_materno}',
        s_telefono = '${s_telefono}',
        s_foto = s_foto,
        d_fecha_nacimiento = TO_DATE('${d_fecha_nacimiento}', \'DD/MM/YYYY\')
        WHERE sk_usuario = '${sk_usuario}'`)
            .then(() => {
                res.status(200).json({ message: 'Usuario modificado correctamente', status: true });
            })
            .catch((error) => {
                console.error('Error:', error);
                res.status(500).json({ message: 'Hubo un error al modificar el usuario', status: false });
            });

    }
});

app.post('/renovacion_usuario', multer.single(), async (req, res) => {
    const { sk_usuario, d_fecha_renovacion, f_mensualidad } = req.body;
    const sk_renovacion = uuidv4();

    try {
        // Inicia una transacción
        await db.tx(async (t) => {
            // Verifica si ya existe una renovación para el mismo mes y usuario
            const existingRenewal = await t.oneOrNone(`
                SELECT sk_renovacion
                FROM rel_usuarios_renovaciones
                WHERE sk_usuario = $1
                AND i_renovacion = 1
                    AND EXTRACT(YEAR FROM d_fecha_renovacion) = EXTRACT(YEAR FROM TO_DATE($2, 'DD/MM/YYYY'))
                    AND EXTRACT(MONTH FROM d_fecha_renovacion) = EXTRACT(MONTH FROM TO_DATE($2, 'DD/MM/YYYY'))
                LIMIT 1`,
                [sk_usuario, d_fecha_renovacion]
            );

            if (existingRenewal) {
                // Si existe, actualiza la renovación existente
                await t.none(`
                    UPDATE rel_usuarios_renovaciones
                    SET f_mensualidad = $1,
                    d_fecha_renovacion = TO_DATE($2, 'DD/MM/YYYY')
                    WHERE sk_renovacion = $3`,
                    [f_mensualidad, d_fecha_renovacion, existingRenewal.sk_renovacion]
                );
            } else {
                // Si no existe, inserta una nueva renovación
                await t.none(`
                    INSERT INTO rel_usuarios_renovaciones
                        (sk_renovacion, sk_usuario, d_fecha_renovacion, f_mensualidad, i_renovacion)
                    VALUES
                        ($1, $2, CURRENT_TIMESTAMP, $3, 1)`,
                    [sk_renovacion, sk_usuario, f_mensualidad]
                );
            }

            // Actualiza la tabla cat_usuarios
            await t.none(`
                UPDATE cat_usuarios
                SET f_mensualidad = $1, d_fecha_inscripcion = TO_DATE($2, 'DD/MM/YYYY')
                WHERE sk_usuario = $3`,
                [f_mensualidad, d_fecha_renovacion, sk_usuario]
            );
        });

        res.status(200).json({ message: 'Renovación agregada correctamente', status: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Hubo un error al renovar usuario', status: false });
    }
});

app.post('/eliminarUsuario', (req, res) => {

    const {
        sk_usuario,
    } = req.body;

    db.none(`
    UPDATE cat_usuarios SET
    sk_estatus = 'IN',
    d_fecha_cancelado = CURRENT_TIMESTAMP
    WHERE sk_usuario = '${sk_usuario}' `)
        .then(() => {
            res.status(200).json({ message: 'Usuario eliminado correctamente', status: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al eliminar el usuario', status: false });
        });
});

app.get('/obtenerUsuarios', async (req, res) => {

    const sk_empresa = req.query.sk_empresa
    const i_administrador = req.query.i_administrador
    const sk_licencia = req.query.sk_licencia

    /* Validacion para verificar el estatus del cliente */

    if (i_administrador == 0) {
        const middelware_empresa = await verificarEstadoEmpresa(sk_empresa);
        if (!middelware_empresa.success) {
            return res.json(middelware_empresa)
        }

        const middelware_licencia = await verificarEstadoLicencia(sk_licencia);
        if (!middelware_licencia.success) {
            return res.json(middelware_licencia)
        }
    }

    db.any(`
    SET TIME ZONE 'America/Mexico_City';
            SELECT N2.*,
            CASE WHEN EXTRACT(MONTH FROM d_fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
                        AND EXTRACT(DAY FROM d_fecha_nacimiento) = EXTRACT(DAY FROM CURRENT_DATE)
                    THEN 1
                    ELSE 0
            END AS cumpleaños
        FROM (
            SELECT N1.*,
                DATE_PART('day', d_fecha_renovacion - CURRENT_DATE) AS dias_restantes
            FROM (
                SELECT 
                    cu.sk_estatus,
                    cu.sk_usuario,
                    cu.s_nombre,
                    CONCAT(cu.s_nombre, ' ', cu.s_apellido_paterno, ' ', cu.s_apellido_materno) AS s_nombre_completo,
                    cu.s_apellido_paterno,
                    cu.s_apellido_materno,
                    cu.s_telefono,
                    cu.s_foto,
                    cu.d_fecha_nacimiento,
                    cu.d_fecha_inscripcion,
                    cu.d_fecha_inscripcion + INTERVAL '1 month' AS d_fecha_renovacion,
                    cu.d_fecha_creacion,
                    cu.sk_empresa,
                    ce.s_nombre_empresa
                FROM cat_usuarios cu
                INNER JOIN cat_empresas ce ON ce.sk_empresa = cu.sk_empresa
                WHERE cu.sk_estatus = 'AC'
                AND ce.sk_empresa = $1
            ) AS N1
        ) AS N2
        ORDER BY N2.dias_restantes `, [sk_empresa])
        .then((data) => {
            return res.json({ data: data, success: true, message: 'Datos cargados exitosamente!' })
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al agregar el usuario', success: false });
        });
})

app.get('/obtenerUsuarios/:sk_usuario', async (req, res) => {
    const sk_usuario = req.params.sk_usuario;
    const sk_empresa = req.query.sk_empresa
    const i_administrador = req.query.i_administrador
    const sk_licencia = req.query.sk_licencia

    if (i_administrador == 0) {
        const middelware_empresa = await verificarEstadoEmpresa(sk_empresa);
        if (!middelware_empresa.success) {
            return res.json(middelware_empresa)
        }

        const middelware_licencia = await verificarEstadoLicencia(sk_licencia);
        if (!middelware_licencia.success) {
            return res.json(middelware_licencia)
        }
    }

    db.one(`
    SET TIME ZONE 'America/Mexico_City';
    SELECT N2.*, 
            CASE WHEN EXTRACT(MONTH FROM d_fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
                        AND EXTRACT(DAY FROM d_fecha_nacimiento) = EXTRACT(DAY FROM CURRENT_DATE)
                    THEN 1
                    ELSE 0
            END AS cumpleaños
        FROM (
            SELECT N1.*,
                DATE_PART('day', d_fecha_renovacion - CURRENT_DATE) AS dias_restantes
            FROM (
                SELECT 
                    cu.sk_estatus,
                    cu.sk_usuario,
                    cu.s_nombre,
                    CONCAT(cu.s_nombre, ' ', cu.s_apellido_paterno, ' ', cu.s_apellido_materno) AS s_nombre_completo,
                    cu.s_apellido_paterno,
                    cu.s_apellido_materno,
                    cu.s_telefono,
                    cu.f_mensualidad,
                    cu.s_foto,
                    cu.s_foto AS url_foto,
                    cu.d_fecha_nacimiento,
                    cu.d_fecha_inscripcion,
                    cu.d_fecha_inscripcion + INTERVAL '1 month' AS d_fecha_renovacion,
                    cu.d_fecha_creacion,
                    cu.sk_empresa,
                    ce.s_nombre_empresa
                FROM cat_usuarios cu
                INNER JOIN cat_empresas ce ON ce.sk_empresa = cu.sk_empresa
                WHERE cu.sk_estatus = 'AC'
                AND sk_usuario = $1
            ) AS N1
        ) AS N2
        ORDER BY N2.dias_restantes`, [sk_usuario])
        .then((data) => {
            res.json(data)
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al obtener información del usuario', status: false });
        });
})

app.post('/eliminarFoto', async (req, res) => {
    const { sk_usuario } = req.body;

    try {
        const data = await db.one(`SELECT s_foto FROM cat_usuarios WHERE sk_usuario = '${sk_usuario}' `);
        const urlParts = data.s_foto.split(bucket_name + '/');
        const filename = urlParts[urlParts.length - 1];
        await deletePhoto(bucket_name, filename);

        await db.none(`UPDATE cat_usuarios SET s_foto = null WHERE sk_usuario = '${sk_usuario}' `);
        res.status(200).json({ message: 'Foto eliminada con éxito', status: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Hubo un error al eliminar la foto', status: false });
    }
});

app.get('/detalle_usuario/:sk_usuario', (req, res) => {
    const sk_usuario = req.params.sk_usuario;

    db.one(`
    SET TIME ZONE 'America/Mexico_City';
    SELECT N2.*, 
            CASE WHEN EXTRACT(MONTH FROM d_fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
                        AND EXTRACT(DAY FROM d_fecha_nacimiento) = EXTRACT(DAY FROM CURRENT_DATE)
                    THEN 1
                    ELSE 0
            END AS cumpleaños
        FROM (
            SELECT N1.*,
                DATE_PART('day', d_fecha_renovacion - CURRENT_DATE) AS dias_restantes
            FROM (
                SELECT 
                    cu.sk_estatus,
                    cu.sk_usuario,
                    cu.s_nombre,
                    CONCAT(cu.s_nombre, ' ', cu.s_apellido_paterno, ' ', cu.s_apellido_materno) AS s_nombre_completo,
                    cu.s_apellido_paterno,
                    cu.s_apellido_materno,
                    cu.s_telefono,
                    cu.s_foto,
                    cu.d_fecha_nacimiento,
                    cu.d_fecha_inscripcion,
                    cu.d_fecha_inscripcion + INTERVAL '1 month' AS d_fecha_renovacion,
                    cu.d_fecha_creacion,
                    cu.sk_empresa,
                    ce.s_nombre_empresa
                FROM cat_usuarios cu
                INNER JOIN cat_empresas ce ON ce.sk_empresa = cu.sk_empresa
                WHERE cu.sk_estatus = 'AC'
                AND sk_usuario = $1
            ) AS N1
        ) AS N2
        ORDER BY N2.dias_restantes`, [sk_usuario])
        .then((data) => {
            let d_fecha_inscripcion = moment(data.d_fecha_inscripcion).format('DD/MM/YYYY');
            let d_fecha_renovacion = moment(data.d_fecha_renovacion).format('DD/MM/YYYY');
            let d_fecha_creacion = moment(data.d_fecha_creacion).format('DD/MM/YYYY');

            res.render('detalle_usuario', { usuario: { ...data, d_fecha_inscripcion, d_fecha_renovacion, d_fecha_creacion } });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al obtener información del usuario', status: false });
        });
})


/* **************************ESTADISTICAS********************************* */

app.get('/obtenerEstadisticas', async (req, res) => {
    try {

        const sk_empresa = req.query.sk_empresa;
        const i_administrador = req.query.i_administrador;
        const sk_licencia = req.query.sk_licencia;
        const filtro = req.query.filtro;
        const year = parseInt(req.query.year);

        /* Validacion para verificar el estatus del cliente */

        if (i_administrador == 0) {
            const middelware_empresa = await verificarEstadoEmpresa(sk_empresa);
            if (!middelware_empresa.success) {
                return res.json(middelware_empresa)
            }

            const middelware_licencia = await verificarEstadoLicencia(sk_licencia);
            if (!middelware_licencia.success) {
                return res.json(middelware_licencia)
            }
        }

        let years = [];

        let primerSemestre = [];
        let segundoSemestre = [];
        let semanal = null;

        let ganancias_primerSemestre = [];
        let ganancias_segundoSemestre = [];

        let renovaciones_primerSemestre = [];
        let renovaciones_segundoSemestre = [];

        years = await db.any(`
        SELECT EXTRACT(YEAR FROM d_fecha_creacion) AS anio
        FROM cat_usuarios
        WHERE sk_empresa = $1
        GROUP BY anio
        ORDER BY anio;`,
            [sk_empresa]
        );


        if (filtro === 'usuarios') {


            segundoSemestre = await db.any(`
            SELECT EXTRACT(MONTH FROM d_fecha_creacion) AS mes, COUNT(*) AS usuarios
            FROM cat_usuarios
            WHERE EXTRACT(MONTH FROM d_fecha_creacion) BETWEEN 7 AND 12
            AND EXTRACT(YEAR FROM d_fecha_creacion) = $1
            AND sk_empresa = $2
            GROUP BY mes
            ORDER BY mes;`,
                [year, sk_empresa]
            );

            primerSemestre = await db.any(`
            SELECT EXTRACT(MONTH FROM d_fecha_creacion) AS mes, COUNT(*) AS usuarios
            FROM cat_usuarios
            WHERE EXTRACT(MONTH FROM d_fecha_creacion) BETWEEN 1 AND 6
            AND EXTRACT(YEAR FROM d_fecha_creacion) = $1
            AND sk_empresa = $2
            GROUP BY mes
            ORDER BY mes`,
                [year, sk_empresa]
            );

            segundoSemestre = await db.any(`
            SELECT EXTRACT(MONTH FROM d_fecha_creacion) AS mes, COUNT(*) AS usuarios
            FROM cat_usuarios
            WHERE EXTRACT(MONTH FROM d_fecha_creacion) BETWEEN 7 AND 12
            AND EXTRACT(YEAR FROM d_fecha_creacion) = $1
            AND sk_empresa = $2
            GROUP BY mes
            ORDER BY mes;`,
                [year, sk_empresa]
            );

            semanal = await db.one(`
            SELECT COUNT(*) AS usuarios
            FROM cat_usuarios
            WHERE d_fecha_creacion BETWEEN date_trunc('week', current_date) AND (date_trunc('week', current_date) + interval '6 days')
            AND EXTRACT(YEAR FROM d_fecha_creacion) = $1
            AND sk_empresa = $2`,
                [year, sk_empresa]
            );

        }

        if (filtro === 'ingresos') {

            ganancias_primerSemestre = await db.any(`
        SELECT EXTRACT(MONTH FROM rur.d_fecha_renovacion) AS mes,
        SUM(rur.f_mensualidad) AS total_mensualidad
        FROM rel_usuarios_renovaciones rur
        INNER JOIN cat_usuarios cu ON cu.sk_usuario = rur.sk_usuario
        WHERE EXTRACT(MONTH FROM d_fecha_renovacion) BETWEEN 1 AND 6
        AND EXTRACT(YEAR FROM d_fecha_creacion) = $1
        AND cu.sk_empresa = $2
        GROUP BY mes
        ORDER BY mes;`,
                [year, sk_empresa]
            );

            ganancias_segundoSemestre = await db.any(`
            SELECT EXTRACT(MONTH FROM rur.d_fecha_renovacion) AS mes,
            SUM(rur.f_mensualidad) AS total_mensualidad
            FROM rel_usuarios_renovaciones rur
            INNER JOIN cat_usuarios cu ON cu.sk_usuario = rur.sk_usuario
            WHERE EXTRACT(MONTH FROM d_fecha_renovacion) BETWEEN 7 AND 12
            AND EXTRACT(YEAR FROM d_fecha_creacion) = $1
            AND cu.sk_empresa = $2
            GROUP BY mes
            ORDER BY mes;`,
                [year, sk_empresa]
            );

        }

        if (filtro === 'renovaciones') {

            renovaciones_primerSemestre = await db.any(`
            SELECT EXTRACT(MONTH FROM rur.d_fecha_renovacion) AS mes,
            COUNT(*) AS renovaciones
            FROM rel_usuarios_renovaciones rur
            INNER JOIN cat_usuarios cu ON cu.sk_usuario = rur.sk_usuario
            WHERE EXTRACT(MONTH FROM d_fecha_renovacion) BETWEEN 1 AND 6
            AND EXTRACT(YEAR FROM d_fecha_creacion) = $1
            AND rur.i_renovacion = 1
            AND cu.sk_empresa = $2
            GROUP BY mes
            ORDER BY mes;`,
                [year, sk_empresa]
            );

            renovaciones_segundoSemestre = await db.any(`
            SELECT EXTRACT(MONTH FROM rur.d_fecha_renovacion) AS mes,
            COUNT(*) AS renovaciones
            FROM rel_usuarios_renovaciones rur
            INNER JOIN cat_usuarios cu ON cu.sk_usuario = rur.sk_usuario
            WHERE EXTRACT(MONTH FROM d_fecha_renovacion) BETWEEN 7 AND 12
            AND EXTRACT(YEAR FROM d_fecha_creacion) = $1
            AND rur.i_renovacion = 1
            AND cu.sk_empresa = $2
            GROUP BY mes
            ORDER BY mes;`,
                [year, sk_empresa]
            );

            semanal = await db.one(`
            SELECT COUNT(*) AS renovaciones
            FROM rel_usuarios_renovaciones rur
            INNER JOIN cat_usuarios cu ON cu.sk_usuario = rur.sk_usuario
            WHERE d_fecha_renovacion BETWEEN date_trunc('week', current_date) AND (date_trunc('week', current_date) + interval '6 days')
            AND EXTRACT(YEAR FROM d_fecha_renovacion) = $1
            AND rur.i_renovacion = 1
            AND cu.sk_empresa = $2`,
                [year, sk_empresa]
            );

        }

        res.status(200).json({
            datos: {
                years,
                primerSemestre,
                segundoSemestre,
                semanal,
                ganancias_primerSemestre,
                ganancias_segundoSemestre,
                renovaciones_primerSemestre,
                renovaciones_segundoSemestre
            }, message: 'Analisis obtenidos correctamente', status: true
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Hubo un error al renovar usuario', status: false });
    }
})

/* NOTIFICACIONES */
app.post('/registrar_notificacion', (req, res, next) => {

    const { s_token_notificacion, sk_empresa, sk_licencia } = req.body;
    let sk_licencia_notificacion = uuidv4();

    db.none(`
    INSERT INTO 
    rel_licencias_notificaciones
    VALUES ($1, $2, $3, $4)`,
        [sk_licencia_notificacion, sk_licencia, s_token_notificacion, sk_empresa])
        .then((data) => {
            res.status(200).json({ message: 'Notificaciones registradas con éxito', status: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al editar el negocio', status: false });
        });



});

/* TAREA AUTOMATICAS */

/* 7:00 am */
cron.schedule('0 7 * * *', () => {

    notificacion_cumpleañeros();
    notificacion_dias();

});

/* 5:00 pm */
cron.schedule('0 15 * * *', () => {

    notificacion_cumpleañeros();
    notificacion_dias();

});


const notificacion_cumpleañeros = async () => {
    const today = moment().tz('America/Mexico_City').format('YYYY-MM-DD');

    let array_token = [];

    usuarios = await db.any(`SELECT * FROM cat_usuarios WHERE d_fecha_nacimiento = $1`, [today])

    for (usuario of usuarios) {
        tokens = await db.any(`SELECT * FROM rel_licencias_notificaciones WHERE sk_empresa = $1`, [usuario?.sk_empresa])
        for (token of tokens) {
            array_token.push(token?.s_token_notificacion)
        }
    }

    const message = {
        to: array_token,
        sound: 'default',
        title: '¡Hoy tenemos cumpleañeros! 🎂',
        body: 'Ingresa a la aplicación para mandarle un mensaje de felicitaciones automático desde el detalle del usuario.',
        data: { anyData: 'puedes incluir datos adicionales aquí' },
    };

    expo.sendPushNotificationsAsync([message])
        .then((receipts) => {
            // Maneja las respuestas (puede haber errores, etc.)
            console.log('Cumpleañeros', receipts);
        })
        .catch((error) => {
            console.error('Error al enviar la notificación:', error);
        });
}

const notificacion_dias = async () => {

    let array_token = [];

    usuarios = await db.any(`SELECT N2.* FROM (
        SELECT N1.*,
            DATE_PART('day', N1.d_fecha_renovacion - CURRENT_DATE) AS dias_restantes
        FROM (
            SELECT 
                CONCAT(cu.s_nombre) AS s_nombre_completo,
                cu.d_fecha_inscripcion + INTERVAL '1 month' AS d_fecha_renovacion,
                cu.sk_empresa,
                cu.sk_estatus
            FROM cat_usuarios cu
            INNER JOIN cat_empresas ce ON ce.sk_empresa = cu.sk_empresa
            WHERE cu.sk_estatus = 'AC'
        ) AS N1 
     ) AS N2 WHERE N2.dias_restantes <= 1 AND N2.dias_restantes >= 0
    ORDER BY N2.dias_restantes`)


    for (usuario of usuarios) {
        tokens = await db.any(`SELECT * FROM rel_licencias_notificaciones WHERE sk_empresa = $1`, [usuario?.sk_empresa])
        for (token of tokens) {
            array_token.push(token?.s_token_notificacion)
        }
    }

    const message = {
        to: array_token,
        sound: 'default',
        title: '¡Usuarios próximos a vencer! 🗓️',
        body: 'Se acerca la fecha de renovación para algunos usuarios en tu aplicación',
        data: { anyData: 'puedes incluir datos adicionales aquí' },
    };

    expo.sendPushNotificationsAsync([message])
        .then((receipts) => {
            // Maneja las respuestas (puede haber errores, etc.)
            console.log('Cumpleañeros', receipts);
        })
        .catch((error) => {
            console.error('Error al enviar la notificación:', error);
        });
}



//************************************************************** */

async function deletePhoto(bucketName, filename) {
    await storage.bucket(bucketName).file(filename).delete();
}

async function verificarEstadoEmpresa(sk_empresa) {

    let result;

    if (!sk_empresa) {
        return false
    }

    await db.one(`SELECT sk_estatus FROM cat_empresas WHERE sk_empresa = $1`, [sk_empresa])
        .then((data) => {
            if (data.sk_estatus === 'AC') {
                result = { message: 'La empresa si esta activa', success: true, empresa_cancelada: false }
            } else {
                result = { message: 'La empresa se encuentra INACTIVA', success: false, empresa_cancelada: true }
            }
        })
        .catch((error) => {
            console.log(error)
            return false
        });

    return result
}

async function verificarEstadoLicencia(sk_licencia) {

    let result;

    if (!sk_licencia) {
        return false
    }

    await db.one(`SELECT sk_estatus FROM cat_licencias WHERE sk_licencia = $1`, [sk_licencia])
        .then((data) => {
            if (data.sk_estatus === 'AC') {
                result = { message: 'La licencia si esta activa', success: true, empresa_cancelada: false }
            } else {
                result = { message: 'La licencia se encuentra INACTIVA', success: false, empresa_cancelada: true }
            }
        })
        .catch((error) => {
            console.log(error)
            return false
        });

    return result
}

//************************************************************** */

app.listen(port, () => {
    console.log(`Aplicación GYM APP Corriendo en el puerto ${port}`);
})
