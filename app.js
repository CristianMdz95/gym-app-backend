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


// LOCAL app.post('/nuevo_usuario', upload.single('photo'), (req, res) => {
app.post('/nuevo_usuario', multer.single('photo'), (req, res, next) => {

    if (!req.file) {
        res.status(400).send('Error, archivo no subido.');
        return;
    }

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
              CURRENT_TIMESTAMP
          )`, [sk_usuario, s_nombre, s_apellido_paterno, s_apellido_materno, s_telefono, s_foto, d_fecha_nacimiento, d_fecha_inscripcion, 'AC'])
            .then(() => {
                res.status(200).json({ message: 'Usuario insertado correctamente', status: true });
            })
            .catch((error) => {
                console.error('Error:', error);
                res.status(500).json({ message: 'Hubo un error al insertar el usuario', status: false });
            });
    });

    blobStream.end(req.file.buffer);
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

    if (!req.file) {
        res.status(400).send('No file uploaded.');
        return;
    }

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
});

app.post('/eliminarUsuario', (req, res) => {

    const {
        sk_usuario,
    } = req.body;

    db.none(`
    UPDATE cat_usuarios SET
    sk_estatus = 'CA',
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

app.get('/obtenerUsuarios', (req, res) => {
    db.any(`
    SELECT N2.* FROM (
        SELECT N1.*, DATE_PART('day', d_fecha_renovacion - CURRENT_DATE) as dias_restantes FROM
            (
                SELECT 
                sk_estatus,
                sk_usuario,
                s_nombre,
                CONCAT(s_nombre, ' ', s_apellido_paterno, ' ', s_apellido_materno) AS s_nombre_completo,
                s_apellido_paterno,
                s_apellido_materno,
                s_telefono,
                s_foto,
                d_fecha_nacimiento,
                d_fecha_inscripcion,
                d_fecha_inscripcion + INTERVAL '1 month' as d_fecha_renovacion,
                d_fecha_creacion
                FROM cat_usuarios WHERE sk_estatus = 'AC'
            ) AS N1
        ) AS N2 ORDER BY N2.dias_restantes `)
        .then((data) => {
            res.json(data)
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ message: 'Hubo un error al agregar el usuario', status: false });
        });
})

app.get('/obtenerUsuarios/:sk_usuario', (req, res) => {
    const sk_usuario = req.params.sk_usuario;
    const host = process.env.HOSTURL ?? String(req.protocol + '://' + req.headers.host)

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
        s_foto AS url_foto,
        d_fecha_nacimiento,
        d_fecha_inscripcion,
        d_fecha_inscripcion + INTERVAL '1 month' as d_fecha_renovacion,
        d_fecha_creacion
        FROM cat_usuarios
    ) AS N1 WHERE N1.sk_usuario = '${sk_usuario}'`)
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

app.listen(port, () => {
    console.log(`Aplicación GYM APP Corriendo en el puerto ${port}`);
})
