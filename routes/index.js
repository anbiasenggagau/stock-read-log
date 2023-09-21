var express = require('express');
var router = express.Router();
const stock_read_log = require('../models/stock_read_log');
const FileSystem = require("fs");

router.use('/export-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();

  FileSystem.writeFile('./stock_read_log.json', JSON.stringify(list), (error) => {
    if (error) throw error;
  });

  console.log('stock_read_log.json exported!');
  res.json({ statusCode: 1, message: 'stock_read_log.json exported!' })
});

router.use('/import-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();

  FileSystem.readFile('./stock_read_log.json', async (error, data) => {
    if (error) throw error;

    const list = JSON.parse(data);

    const deletedAll = await stock_read_log.deleteMany({});

    const insertedAll = await stock_read_log.insertMany(list);

    console.log('stock_read_log.json imported!');
    res.json({ statusCode: 1, message: 'stock_read_log.json imported!' })
  });


})

router.use('/edit-repacking-data', async (req, res) => {

  // Silahkan dikerjakan disini.
  // Verify rejected QR
  const reject_qr_list = await stock_read_log.find({ payload: { $in: req.body.reject_qr_list.map(value => value.payload) }, company_id: req.body.company_id })
  const fixedRejectQrList = reject_qr_list.map(value => value)

  // Verify New QR
  const new_qr_list = await stock_read_log.find({ payload: { $in: req.body.new_qr_list.map(value => value.payload) }, company_id: req.body.company_id })
  const fixedNewQrList = new_qr_list.map(value => value)

  // Get all payload who has New QR
  const changedNestedObject = await stock_read_log.find({
    'qr_list.payload': { $in: fixedNewQrList.map(value => value.payload) }
  })

  // Get the dest payload for New QR and Rejected QR
  const changedObject = await stock_read_log.findOne({ payload: req.body.payload })

  // Delete all qr_list payload who has both New QR & Rejected QR
  await stock_read_log.updateMany({ company_id: req.body.company_id },
    {
      $pull: {
        qr_list: {
          payload: {
            $in: [
              ...fixedNewQrList.map(value => value.payload),
              ...fixedRejectQrList.map(value => value.payload)
            ]
          }
        }
      },
    })

  // Insert New QR to dest payload
  await stock_read_log.updateMany({ payload: changedObject.payload },
    {
      $push: {
        qr_list: {
          $each: fixedNewQrList.map(value => value)
        }
      }
    })

  // Update Rejected QR Status
  await stock_read_log.updateMany({ payload: { $in: fixedRejectQrList.map(value => value.payload) } },
    {
      status: 0,
      status_qc: 1
    })

  // Update all payload qty
  const data = await stock_read_log.find({ payload: [changedObject.payload, ...changedNestedObject.map(value => value.payload)] })
  data.forEach(async value => {
    await stock_read_log.updateOne({ payload: value.payload }, { qty: value.qr_list.length })
  })

  res.status(200).json({
    status: 'success'
  })
})

router.use('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
