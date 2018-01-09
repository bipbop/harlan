import jDataView from 'jdataview';
import { sprintf } from 'sprintf';
import { CMC7Parser } from './cmc7-parser';
import async from 'async';
import { CPF } from 'cpf_cnpj';
import { CNPJ } from 'cpf_cnpj';
import slug from 'slug';

slug.defaults.modes.pretty = {
    replacement: ' ',      // replace spaces with replacement
    symbols: false,         // replace unicode symbols or not
    lower: false,           // result in lower case
    charmap: slug.charmap, // replace special characters
    multicharmap: slug.multicharmap // replace multi-characters
};

slug.defaults.mode ='pretty';

const NON_NUMERIC = /[\D]/g;
const NON_WORD = /[\W]/g;
const ROW_SIZE = 502;
const BAN_VERSION = '02.7';
const MAX_THREADS = 2;
const CRLF = '\r\n';

export class BANFactory {
    constructor(call, {values}, company) {
        this.call = call;
        this.checks = values;
        this.company = company;
        this.size = this._fileLength();
        this.buffer = new jDataView(new ArrayBuffer(this.size));
    }

    _fillBuffer() {
        this.buffer.setString(0, new Array(this.size).join(' '));
        for (let i = 0; i < this.size; i += ROW_SIZE) {
            this.buffer.setString(i + ROW_SIZE - CRLF.length, CRLF);
        }
    }

    _fileLength() {
        // ROW_SIZE * (1HEADER + 1FOOTER + NCHECKS)
        return ROW_SIZE * (2 + this.checks.length * 2);
    }

    _getFirstCellPhone(doc) {
        let $phoneNode = $(doc).find('BPQL > body > xml > telefones > telefone');
        let ret = '';
        $phoneNode.each((i, el) => {
            let ddd = $(el).find('ddd').text();
            let phoneNumber = $(el).find('numero').text();
            if (this._isCellPhone(phoneNumber)) ret = ddd + phoneNumber;
        });
        return ret;
    }

    _getFirstEmail(doc) {
        let $emailNode = $(doc).find('BPQL > body > xml > emails > email').first();
        let email = $emailNode.find('email').text();
        return email;
    }

    _getFirstPhone(doc) {
        let $phoneNode = $(doc).find('BPQL > body > xml > telefones > telefone');
        let ret = '';
        $phoneNode.each((i, el) => {
            let ddd = $(el).find('ddd').text();
            let phoneNumber = $(el).find('numero').text();
            if (!this._isCellPhone(phoneNumber)) ret = ddd + phoneNumber;
        });
        return ret;
    }

    /**
     * Retorna o logradouro abreviado
     * @param  {string} logradouro
     * @return {string}
     */
    _getLogradouroAbrev(logradouro) {
        return logradouro;
    }

    _goToPosition(row, col) {
        if (row < 0) {
            // last row is (BUF_SIZE - ROW_SIZE) * MATH.ABS(-1)
            let start = (this.size - ROW_SIZE) * Math.abs(row);
            return start + col;
        }
        return (ROW_SIZE * row) + col;
    }

    _isCellPhone(tel) {
        if (parseInt(tel.charAt(0), 10) >= 6) {
            return true;
        }
        return false;
    }

    _totalValue() {
        let sum = 0;
        for (let check of this.checks) {
            let value = check.ammount === null ? 0 : check.ammount;
            sum += value;
        }
        return sum;
    }

    generate(modal, progressUpdate, callback) {
        this._fillBuffer();
        this.generateHeader();
        this.generateChecks();
        this.generateFooter();

        const tasks = async.queue(({cpf, cnpj, row}, callback) => {
            let name = '';
            async.parallel([callback => {
                this.call('SELECT FROM \'BIPBOPJS\'.\'CPFCNPJ\'', {
                    data : {documento : cpf || cnpj },
                    success : ret => {
                        name = $('BPQL > body > nome', ret).text();
                        if (!name) {
                            name = 'NOME DO TITULAR NAO RASTREAVEL';
                        }
                        this.buffer.setString(this._goToPosition(row, 32),
                            slug(name).substring(0, 40));
                    },
                    complete: () => { callback(); }
                });
            }, callback => {
                let doc = CPF.strip(cpf) || CNPJ.strip(cnpj);
                let soma = 0;
                this.call('SELECT FROM \'CCF\'.\'CONSULTA\'', {
                    data: {doc},
                    success: ret => {
                        $(ret).find('BPQL > body > xml > ccfs > ccf').children().each((i, el) => {
                            let $el = $(el);
                            let tag = $el.prop('tagName');
                            if (!tag.includes('aline')) return;
                            soma += parseInt($el.text(), 10);
                        });
                        // Contato. de 220 até 249. 30.
                        if (soma > 0) {
                            this.buffer.setString(this._goToPosition(row, 219), `CCF(${soma.toString().substring(0, 30)})`);
                        }
                    },
                    complete: () => callback()
                });
            }, callback => {
                this.call('USING \'CCBUSCA\' SELECT FROM \'FINDER\'.\'CONSULTA\'', {
                    data : {documento : cpf || cnpj },
                    success : ret => {
                        // telefone. de 128 até 139. 12.
                        this.buffer.setString(this._goToPosition(row, 127), this._getFirstPhone(ret).trim().substring(0, 12));
                        // celular. de 486 até 497. 12.
                        this.buffer.setString(this._goToPosition(row, 485), this._getFirstCellPhone(ret).trim().substring(0, 12));
                        // email. de 180 até 219. 40.
                        this.buffer.setString(this._goToPosition(row, 179), this._getFirstEmail(ret).trim().substring(0, 40));
                        // partes do endereço
                        $('BPQL > body > xml > enderecos > endereco', ret).first().children().each((i, el) => {
                            const val = $(el).text();
                            switch (i) {
                            case 1:
                                // endereco. de 391 até 430. 40.
                                this.buffer.setString(this._goToPosition(row, 390), slug(val).trim().substring(0, 40));
                                break;
                            case 2:
                                // numero. de 431 até 435. 5.
                                this.buffer.setString(this._goToPosition(row, 430), val.trim().replace(/^0+/, '').substring(0, 5));
                                break;
                            case 3:
                                // cep. de 172 até 179. 8.
                                this.buffer.setString(this._goToPosition(row, 171), val.trim().substring(0, 8));
                                break;
                            case 4:
                                // bairro. de 113 até 127. 15.
                                this.buffer.setString(this._goToPosition(row, 112), slug(val).trim().substring(0, 15));
                                break;
                            case 5:
                                // cidade. de 152 até 169. 18.
                                this.buffer.setString(this._goToPosition(row, 151), slug(val).trim().substring(0, 18));
                                break;
                            case 6:
                                // estado. de 170 até 171. 2.
                                this.buffer.setString(this._goToPosition(row, 169), slug(val).trim().substring(0, 2));
                                break;
                            case 7:
                                // complemento. de 436 até 465. 30.
                                this.buffer.setString(this._goToPosition(row, 435), slug(val).trim().substring(0, 30));
                            }
                        });
                    },
                    complete: () => { callback(); }
                });
            }], () => {
                callback();
            });
        }, MAX_THREADS);

        tasks.drain = () => {
            complete();
            modal.close();
        };

        let i = 0;
        tasks.push(this.checks, () => {
            progressUpdate(++i / this.checks.length);
        });

        var complete = () => {
            callback(new Blob([this.buffer.getString(this.size, 0)], {type: 'application/octet-binary'}));
            complete = () => {}; /* evita duas chamadas */
        };

        modal.createActions().cancel(() => {
            tasks.kill();
            complete();
        });

    }

    generateHeader() {
        let doc = this.company.cnpj || this.company.cpf;

        this.buffer.setString(0, '1');
        // CPF/CNPJ. de 2 a 15. 14.
        this.buffer.setString(1, doc.replace(NON_NUMERIC, '').substring(0, 14));
        // T:CPF/CNPJ. de 16 a 16. 1.
        this.buffer.setString(15, this.company.cnpj ? '1' : '2');
        // Nome do Cedente. de 17 a 56. 40.
        this.buffer.setString(16, slug((this.company.nome || this.company.responsavel)).replace(NON_WORD, ' ').substring(0, 40));
        // Endereco. de 57 a 96. 40.
        let endereco = [
            this.company.endereco[0],
            this.company.endereco[1],
            this.company.endereco[2]
        ].join(' ');
        this.buffer.setString(56, slug(endereco).substring(0, 40));
        // Cidade. de 97 a 114. 18.
        this.buffer.setString(96, slug(this.company.endereco[5]).substring(0, 18));
        // Estado. de 115 a 116. 2.
        this.buffer.setString(114, slug(this.company.endereco[6]).substring(0, 2));
        // CEP. de 117 a 124. 8.
        this.buffer.setString(116, this.company.endereco[4].replace(NON_NUMERIC, '').substring(0, 8));
        // Data de operação. de 180 a 185. 6.
        this.buffer.setString(179, moment().format('DDMMYY'));
        // Fator da operação. de 186 a 192. 7.
        this.buffer.setString(185, sprintf('%07d', 0));
        // Tx efetiva min. de 193 a 199. 7.
        this.buffer.setString(192, sprintf('%07d', 0));
        // Tx serviço. de 200 a 206. 7.
        this.buffer.setString(199, sprintf('%07d', 0));
        // Tx ISS. de 207 a 213. 7.
        this.buffer.setString(206, sprintf('%07d', 0));
        // Tarifa por título. de 214 a 220. 7.
        this.buffer.setString(213, sprintf('%07d', 0));
        // Tx IOF. de 221 até 227. 7.
        this.buffer.setString(220, sprintf('%07d', 0));
        // Tarifa Esporádica. de 230 até 239. 10.
        this.buffer.setString(229, sprintf('%010d', 0));
        // Valor de Repesse para Promotora. de 241 até 250. 10.
        this.buffer.setString(240, sprintf('%010d', 0));
        // Tarifa por cheque. de 251 até 257. 7.
        this.buffer.setString(250, sprintf('%07d', 0));
        // Tx CPMF. de 258 até 264. 7.
        this.buffer.setString(257, sprintf('%07d', 0));
        // Tx Serviço Trustee. de 265 até 271. 7.
        this.buffer.setString(264, sprintf('%07d', 0));
        // 02.7. de 397 a 400. 4.
        this.buffer.setString(396, BAN_VERSION);
    }

    generateChecks() {
        let currentRow = 1;
        for (let check of this.checks) {
            let cmcParts = new CMC7Parser(check.cmc);
            let doc = check.cnpj || check.cpf;
            let ammount = check.ammount === null ? 0 : check.ammount;

            check.row = currentRow;
            /* DOCUMENTO */
            this.buffer.setString(this._goToPosition(currentRow, 0), '2');
            // Documento. de 2 até 7. 6.
            this.buffer.setString(this._goToPosition(currentRow, 1), cmcParts.number.toString().substring(0, 6));
            // CPF/CNPJ. de 18 até 31. 14.
            this.buffer.setString(this._goToPosition(currentRow, 17), doc.replace(NON_NUMERIC, '').substring(0, 14));
            // T:CPF/CNPJ. de 32 até 32. 1.
            this.buffer.setString(this._goToPosition(currentRow, 31), check.cnpj ? '1' : '2');
            // Nome do sacado. de 33 até 72. 40.
            this.buffer.setString(this._goToPosition(currentRow, 32), '0');
            // Endereco. de 73 até 112. 40.
            this.buffer.setString(this._goToPosition(currentRow, 72), '0');
            // Vencimento. de 250 até 255. 6.
            this.buffer.setString(this._goToPosition(currentRow, 249), moment(check.expire).format('DDMMYY'));
            // Valor. de 256 até 267. 12.
            this.buffer.setString(this._goToPosition(currentRow, 255), sprintf('%012d', ammount));
            // Tipo. de 268 até 268. 1.
            this.buffer.setString(this._goToPosition(currentRow, 267), '2');
            // Emissão. de 301 até 306. 6.
            this.buffer.setString(this._goToPosition(currentRow, 300), moment(check.creation * 1000).format('DDMMYY'));
            // Float. de 357 até 358. 2.
            this.buffer.setString(this._goToPosition(currentRow, 356), '00');
            // Desconto. de 370 até 381. 12.
            this.buffer.setString(this._goToPosition(currentRow, 369), sprintf('%012d', 0));
            /* FIM DOCUMENTO */
            currentRow += 1;

            /* CHEQUE */
            this.buffer.setString(this._goToPosition(currentRow, 0), '8');
            // Banco. de 2 a 4. 3.
            this.buffer.setString(this._goToPosition(currentRow, 1), cmcParts.bank.toString().substring(0, 3));
            // Agencia. de 5 até 10. 6.
            this.buffer.setString(this._goToPosition(currentRow, 4), cmcParts.agency.toString().substring(0, 6));
            // Conta. de 11 até 20. 10.
            this.buffer.setString(this._goToPosition(currentRow, 10), cmcParts.account.toString().substring(0, 10));
            // N do Cheque. de 21 até 30. 10.
            this.buffer.setString(this._goToPosition(currentRow, 20), cmcParts.number.toString().substring(0, 10));
            // Praça. de 31 até 33. 3.
            this.buffer.setString(this._goToPosition(currentRow, 30), '018');
            // CMC7. de 34 até 67. 34.
            this.buffer.setString(this._goToPosition(currentRow, 33), `<${cmcParts.c1}<${cmcParts.c2}>${cmcParts.c3}:`.substring(0, 34));
            /* FIM CHEQUE */
            currentRow += 1;
        }
    }

    generateFooter() {
        this.buffer.setString(this._goToPosition(-1, 0), '3');
        // Quantidade. de 2 até 7. 6.
        this.buffer.setString(this._goToPosition(-1, 1), sprintf('%06d', this.checks.length).substring(0, 6));
        // Valor Total. de 8 até 19. 12.
        this.buffer.setString(this._goToPosition(-1, 7), sprintf('%012d', this._totalValue()).substring(0, 12));
    }
}
