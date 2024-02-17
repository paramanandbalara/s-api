const Layout = require('es6views').Layout
const dayjs = require('dayjs');

class rider_pdf extends Layout {
    parse() {
        let html = this.content();
        this._markup = html
    }
    content() {

        let data = this.data
        data= data.orders;

        let tableHead = `
        <thead>
            <tr>
                <th>Delivery#</th>
                <th>Delivery Address</th>
                <th>Contact Name</th>   
                <th>Contact No.</th>  
                <th>Package Count</th> 
                <th>Awbs</th>
                <th style="min-width:180px">Signature</th> 

                <th style= "text-align:center">Delivery#</th>
                <th style= "text-align:center">Delivery Address</th>
                <th style= "text-align:center">Contact Name</th>   
                <th style= "text-align:center" width:102px>Contact No.</th>  
                <th style= "width:80px; text-align:center">Package Count</th> 
                <th style="text-align:center">Awbs</th>
                <th style="min-width:150px; text-align:center">Signature</th> 

            </tr>
        </thead>`
        let totalItems = data.length;
        let RowData1 = ''
        let SecondPage = ``; 



        for(let x = 0; x <= totalItems;x += 20){
           
            if(totalItems >= x ){
                if(totalItems < totalItems) x = totalItems
                RowData1 =  this.tableData(data,x,(x+20))
            }
            if(x>0){
                SecondPage += `<div style="page-break-after: always"></div>`;
            }
            SecondPage += `
            
            <div class="container">
                <div class="card card-border">
                <h4 class="commercial">
                Delivery Run Sheet
            </h4>
            <span>Date - ${dayjs(new Date).format('DD-MM-YYYY')} </span>
                    <table class="table" cellpadding="5" border="1" width="100%">
                        ${tableHead}
                        <tbody>
                          ${RowData1}
                        </tbody>
                    </table>
                    
                </div>
            </div>
            `;
     
        }

        /*  */
        let html = `<!DOCTYPE html>
        <html lang="en">
        <head>
                 
        <style>
        * {
            margin: 0
        }

        body {
            padding: 10px;
            font: normal 14px sans-serif;
            color: #555;
            line-height: 20px;
        }

        table {
            border-collapse: collapse;
            margin-bottom: 10px;
            page-break-inside: auto;
            border-color: #9e9e9e;

        }

        h4 {
            font-size: 16px;
            font-weight: bold;
            color: #000
        }

        b,
        th {
            font-size: 14px;
            color: #000;
            font-weight: bold !important;
            text-align: left;
            white-space: nowrap;
        }

        .commercial {
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

        .container {
            border: 2px solid #333;
            padding: 10px;
            margin-top: 20px;
        }

        td {
            word-wrap: break-word;
        }
    </style>   
        <title>Shypmax Invoice</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
            <center>
                <div class = "">
                    <img style = "padding-top: 10px;padding-bottom: 10px;" src="https://shypmax.com/images/shypmaxlogofooter.png">
                </div>
            </center>
            
            ${SecondPage}
           
        </body>
        </html>`
        return html
    }

    tableData(data,iterator,limit){
        let rowdata = ''
        for (let i = iterator; i < limit; i++) {
            if(i >= data.length) break;
                rowdata += `
                <tr style="height:50px;" >
                    <td align="center">${data[i].delivery_request_no}</td>
                    <td align="center">${data[i].address}, ${data[i].city}</td>
                    <td align="center">${data[i].contact_name}</td>
                    <td align="center">${data[i].contact_number}</td>
                    <td align="center">${data[i].orders_count}</td>
                    <td align="center" style = "word-wrap : break-word; word-break : break-word; max-width:6rem;">${data[i].awb}</td>
                    <td></td>
                </tr>`
        } 
        
        return rowdata
    }

}

module.exports = rider_pdf