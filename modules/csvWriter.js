const fs = require('fs');

class CsvWriter {

	coersions = {};

	constructor () { }

	async initialize ({schema, filePath}) {
		if (!schema?.length)
			throw new Error ('Schema cannot be empty')

		if (!filePath)
			filePath = "/tmp/" + "csvFile" + (+new Date) + ".csv"

		this.filePath = filePath

		this.file = await fs.createWriteStream(this.filePath)

		this.headers = schema.map(val => val.header)
		this.keys = schema.map(val => val.key)

		let headerObj = {}

		schema.forEach(field => {
			headerObj[field.key] = field.header
			if(field.coerceString)
				this.coersions[field.key] = true
		})

		await this.writeRow(headerObj)

	}

	async writeRow (obj) {
		let rowString = ''

		Object.keys(obj).map(k => (
			obj[k] = String(obj[k]).replace(/['",\r\n\t;]/g, ' ')
		))
 
		this.keys.forEach(key => { 

			if(this.coersions[key]) {

				rowString += '="'+(obj[key] + '",')

			} else {

				rowString += (obj[key] + ',')

			}
		})
 

		rowString += '\n'

		let resolve, reject
		let p = new Promise((res, rej) => { resolve = res; reject = rej } )
		this.file.write(rowString, () => { resolve() })
		await p

	}

	async closeFile () {
		this.file.close()
	}

}

module.exports = CsvWriter