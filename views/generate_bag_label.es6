
const {Layout} = require('es6views');

class HubopsBagging extends Layout {
    parse() {
        let html = this.content();
        this._markup = html
    }
    content() {
        const data = this.data.arr_bag_details[0];
        const isBox = data.bag_type === 2;
        const isBag = data.bag_type === 1;
        const html = `
        <center>
            <div class = "d-flex justify-content-center pb-30">
                <img class="sy-logo" src="https://shypmax.com/images/shypmaxlogofooter.png" width="220">
            </div>
        </center>

        <div class="d-flex flex-column label-main">
            <div class="label-row pb-15">
                <div class="d-flex flex-column justify-content-center w-100">
                    <div>
                        <p class="fw600 fs16 pl-20">${isBox ? 'Box Code' : 'Bag Code'}</p>
                    </div>
                    <center>
                        <div class="d-flex justify-content-center">
                            <div class="d-flex flex-column justify-content-center align-items-center">
                                <svg id="barcode_bagcode"></svg>
                                <div class="" style="word-wrap: normal;">
                                    ${data.bag_code}
                                </div>
                            </div>
                        </div>
                    </center>
                </div>
            </div>

            ${isBag ? `
                <div class="label-row pb-15">
                    <div class="d-flex flex-column justify-content-center w-100">
                        <div>
                            <p class="fw600 fs16 pl-20">Seal No.</p>
                        </div>
                        <center>
                            <div class="d-flex justify-content-center">
                                <div class="d-flex flex-column justify-content-center align-items-center">
                                    <svg id="barcode_bagcode"></svg>
                                        <div style="word-wrap: normal;">
                                            ${data.bag_code}
                                        </div>
                                </div>
                            </div>
                        </center>
                    </div>
                </div>` : ''}
            

            <div class="label-row" style="display: -webkit-box;">
                <div class="pt-20 pl-20 label-border" style="width:49%">
                    <span class="fw600 fs16">Origin</span>
                    <div class="d-flex pt-10">
                        ${data.origin_address}
                    </div>
                </div>
                <div class="pt-20 pl-20" style="width:49%">
                    <span class="fw600 fs16">Destination</span>
                    <div class="d-flex pt-10" style="padding-right: 1rem !important;">
                        ${data.destination_address}
                    </div>
                </div>
            </div>
            <div class="label-row" style="display: -webkit-box;">
                <div class="pl-20 pt-20 label-border" style="width:33.33%">
                    <span class="fw600 fs16">Date</span>
                    <div class="d-flex pt-10">
                        ${data.bag_date} 
                    </div>
                </div>
                <div class="pl-20 pt-20 label-border" style="width:33.33%">
                    <span class="fw600 fs16">Weight(Kg)</span>
                    <div class="d-flex pt-10">
                        ${data.bag_weight}
                    </div>
                </div>
                <div class="pl-20 pt-20" style="width:33.33%">
                    <span class="fw600 fs16">Pieces Count</span>
                    <div class="d-flex pt-10">
                        ${data.awb_count}
                    </div>
                </div>
            </div>

        </div>
       
    <style>
        .sy-logo {
            padding-top: 10px;
            padding-bottom: 10px;
        }
        .label-main {
            border: 1px solid black;
        }
        .label-row {
            border: 1px solid black;
        }
        .label-row:nth-last-child(2) {
            min-height: 172px;
        }
        .label-row:nth-last-child(1) {
            min-height: 128px;
        }
        .label-border {
            border-right: 1px solid black;
        }
        .pb-30 {
            padding-bottom: 30PX !important;
        }
        .pt-10 {
            padding-top: 0.625rem !important;
        }
        .justify-content-center {
            justify-content: center !important;
        }
        .d-flex {
            display: flex !important;
        }
        .flex-column {
            flex-direction: column !important;
        }
        .pb-20 {
            padding-bottom: 1.25rem !important;
        }
        .pb-15 {
            padding-bottom: 0.9375rem !important;
        }
        .w-100 {
            width: 100% !important;
        }
        .fw600 {
            font-weight: 600 !important;
        }
        .fs16 {
            font-size: 1rem !important;
        }
        .pl-20 {
            padding-left: 1.25rem !important;
        }
        .pt-20 {
            padding-top: 1.25rem !important;
        }
        .col-6 {
            flex: 0 0 50%;
            max-width: 50%;
        }
        .col-4 {
            flex: 0 0 33.33333%;
            max-width: 33.33333%;
        }
        .align-items-center {
            align-items: center !important;
        }
			</style>

                        <script src="https://app.shyplite.com/js/JsBarcode.all.min.js"></script>
					<script type="text/javascript">
						if (document.querySelector('#barcode_bagcode')) {
							JsBarcode("#barcode_bagcode", "${data.bag_code}", {
							  format: "CODE128",
							  margin: 6,
							  lineColor: "#000",
							  background: 'transparent',
							  width: 2.0,
                              height: 110,
							  displayValue: false
							});
						}
                        if (document.querySelector('#barcode_bag_sealno')) {
							JsBarcode("#barcode_bag_sealno", "${data.bag_sealno}", {
							  format: "CODE128",
							  margin: 6,
							  lineColor: "#000",
							  background: 'transparent',
                              width:${isBox ? 4.0 : 2.0},
                              height: ${isBox ? 220 : 110},
							  displayValue: false
							});
						}
                        
					</script>`
        return html
    }
}

module.exports = HubopsBagging