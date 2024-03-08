const bodyParser = require('body-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const Multer = require('multer');
const path = require('path');
const moment = require('moment');

//GOOGLE CLOUD
const { Storage } = require('@google-cloud/storage');

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

/* 
LOCAL
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'storage/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
}) 

const upload = multer({ storage: storage });
*/

//Conección a la base de datos de postgresql
const pgp = require('pg-promise')();
const db = pgp(
    process.env.DB_URL ??
    'postgres://fl0user:6xlCBe8qOZEs@ep-wandering-snow-a55ot4r0.us-east-2.aws.neon.fl0.io:5432/gym-db?sslmode=require'
);

const app = express();
const port = process.env.PORT ?? 3001;

app.use(bodyParser.json());

app.set('view engine', 'ejs'); //Para leer archivos html en el backend
app.use(express.static('public')) //para que las rutas sean publicas
app.use('/storage', express.static(path.join(__dirname, 'storage'))); //Para definir la carpeta

app.post('/login', (req, res) => {
    const { s_usuario, s_password } = req.body;

    db.one(`SELECT 
            cl.*,
            ce.sk_estatus AS sk_estatus_empresa,
            ce.s_nombre_empresa,
            ce.i_administrador
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

/* ******************************* NEGOCIOS ************************************* */

app.post('/nuevo_negocio', (req, res, next) => {

    const {
        s_nombre_empresa,
    } = req.body;

    let sk_empresa = uuidv4();
    db.none(`
      SET TIMEZONE='America/Mexico_City';
      
      INSERT INTO cat_empresas
      (
          sk_empresa,
          s_usuario,
          s_password,
          d_fecha_creacion,
          sk_estatus,
          i_administrador,
          s_nombre_empresa
      ) VALUES (
          $1,
          $2,
          $3,
          CURRENT_TIMESTAMP,
          $4,
          $5,
          $6
      )`, [sk_empresa, 'prueba', 'prueba', 'AC', 0, s_nombre_empresa])
        .then((data) => {
            console.log(data)
            res.status(200).json({ message: 'Negocio insertado correctamente', status: true });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al insertar el negocio', status: false });
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
          SET TIMEZONE='America/Mexico_City';
          
          INSERT INTO cat_licencias
          (
              sk_licencia,
              sk_estatus,
              s_usuario,
              s_password,
              d_fecha_creacion,
              sk_empresa,
              s_nombre
          ) VALUES (
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

    db.none(`DELETE FROM cat_licencias WHERE sk_licencia = $1 `, [sk_licencia])
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
        const blob = bucket.file(req.file.originalname);
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
                d_fecha_nacimiento,
                d_fecha_inscripcion,
                sk_empresa
            } = req.body;

            const s_foto = publicUrl; // Usamos la URL pública de la imagen
            let sk_usuario = uuidv4();
            db.none(`
              SET TIMEZONE='America/Mexico_City';
              
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
                  d_fecha_creacion
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
                  CURRENT_TIMESTAMP
              )`, [sk_usuario, s_nombre, s_apellido_paterno, s_apellido_materno, s_telefono, s_foto, d_fecha_nacimiento, d_fecha_inscripcion, 'AC', sk_empresa])
                .then((data) => {
                    res.status(200).json({ message: 'Usuario insertado correctamente', status: true });
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
            d_fecha_nacimiento,
            d_fecha_inscripcion,
            sk_empresa
        } = req.body;

        const s_foto = null; // Usamos la URL pública de la imagen
        let sk_usuario = uuidv4();
        db.none(`
          SET TIMEZONE='America/Mexico_City';
          
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
              d_fecha_creacion
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
              CURRENT_TIMESTAMP
          )`, [sk_usuario, s_nombre, s_apellido_paterno, s_apellido_materno, s_telefono, s_foto, d_fecha_nacimiento, d_fecha_inscripcion, 'AC', sk_empresa])
            .then((data) => {
                res.status(200).json({ message: 'Usuario insertado correctamente', status: true });
            })
            .catch((error) => {
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
        d_fecha_inscripcion,
    } = req.body;

    //en caso de que tenga imagen
    if (req.file) {
        // Crea un nuevo blob en el bucket y sube los datos del archivo
        const blob = bucket.file(req.file.originalname);
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
          d_fecha_nacimiento = TO_DATE('${d_fecha_nacimiento}', \'DD/MM/YYYY\'),
          d_fecha_inscripcion = TO_DATE('${d_fecha_inscripcion}', \'DD/MM/YYYY\')
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
        d_fecha_nacimiento = TO_DATE('${d_fecha_nacimiento}', \'DD/MM/YYYY\'),
        d_fecha_inscripcion = TO_DATE('${d_fecha_inscripcion}', \'DD/MM/YYYY\')
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
            SET TIMEZONE='America/Mexico_City';

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
        const urlParts = data.s_foto.split('/');
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
    const host = String(req.protocol + '://' + req.headers.host);

    db.one(`
    SELECT N1.*, DATE_PART('day', d_fecha_renovacion - CURRENT_DATE) as dias_restantes FROM
    (
        SELECT sk_usuario,
        s_nombre,
        CONCAT(s_nombre, ' ', s_apellido_paterno, ' ', s_apellido_materno) AS s_nombre_completo,
        s_apellido_paterno,
        s_apellido_materno,
        s_telefono,
        s_foto,
        CONCAT('${host}', '/storage/', s_foto) url_foto,
        d_fecha_nacimiento,
        d_fecha_inscripcion,
        d_fecha_inscripcion + INTERVAL '1 month' as d_fecha_renovacion,
        d_fecha_creacion
        FROM cat_usuarios
    ) AS N1 WHERE N1.sk_usuario = '${sk_usuario}'`)
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

app.listen(port, () => {
    console.log(`Aplicación GYM APP Corriendo en el puerto ${port}`);
})
