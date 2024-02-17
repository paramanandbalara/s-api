const Layout = require('es6views').Layout
const dayjs = require('dayjs');

class pickupVerify extends Layout {
    parse() {
        let html = this.content();
        this._markup = html
    }
    content() {

        let data = this.data

        let tableHead = `
        <thead>
            <tr>
                <th>Pickup #</th>
                <th>Pickupby</th>
                <th>AWBs</th>
                <th>Total</th>
            </tr>
        </thead>`


        /*  */
        let html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <style>
            * {margin:0}
            body {padding: 10px;font: normal 14px sans-serif; color: #555;line-height: 20px;}
            table {
                border-collapse: collapse;
                margin-bottom: 10px;
                page-break-inside:auto;
                border-color: #9e9e9e;
            }
            h4{font-size: 16px;font-weight: bold; color:#000}
            b, th{font-size: 14px;color:#000;font-weight: bold !important;text-align:left}
            // table, tr, td, th, tbody, thead, tfoot {
            //     page-break-inside: avoid !important;
            // }
            .commercial{
                text-align: center;
                font-size: 30px;
                font-weight: bold;
                border: 1px solid #777;
                font-family: sans-serif;
                background-color: #e5e5e5;
                color: #000;
                padding: 15px;
                margin-bottom: 10px;
            }
            .container{
                border: 2px solid #333;padding: 10px;margin-top:20px;
            }
        </style>    
        <title>Shypmax Invoice</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
            <div class="container">
                <div class="card card-border">
                    
                  <a href="https://app.shypmax.com/login" style="display:block;height:60px;text-align:center;" target="_blank">
                    <img src="https://sx-doc.s3.ap-south-1.amazonaws.com/Images/logo.png" style="background-size:cover;height:45px" alt="Shypmax Login" class="CToWUd"></a>
             
                   <h4 class="commercial">
                        Pickup Summary
                    </h4>
                    <div>
                        <div class="row">
                            <div class="col-md-12">   
                                <table class="table" cellpadding="5" border="0" width="100%">
                                    <tbody>
                                        <tr style="border:none">
                                            <td class="text-right">Pickup Number </td>
                                            <td><strong>: ${data?.result?.pickup_request_no}</strong></td>
                                        </tr>
                                        <tr style="border:none">
                                            <td class="text-right">Pickup Date </td>
                                            <td><strong>: ${dayjs(data?.result?.pickup_date).format("DD-MM-YYYY")}</strong></td>
                                        </tr>
                                        <tr>
                                            <td class="text-right">Pickup By</td>
                                            <td><strong>: ${data?.result?.name ? data?.result?.name : "-"}</strong></td>
                                        </tr>
                                        <tr>
                                            <td class="text-right">Pickup From</td>
                                            <td><strong>: ${data?.address ? data.address : "-"}</strong></td>
                                        </tr>
                                        <tr>
                                            <td class="text-right">Total Packages</td>
                                            <td><strong>: ${data?.awbs_count ? data.awbs_count : "-"}</strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table class="table" cellpadding="5" border="1" width="100%">
                                    <tbody>
                                        <tr>
                                            <td>
                                                ${data.awbs}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
               
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>`
        return html
    }

}

module.exports = pickupVerify