/* global toastr, moment, ammount */
var fileReaderStream = require("filereader-stream"),
        CPF = require("cpf_cnpj").CPF,
        CNPJ = require("cpf_cnpj").CNPJ,
        TEST_BAN_EXTENSION = /\.(rem|ban)$/i,
        concat = require("concat-stream");

import { CMC7Validator } from "./cmc7-validator";

module.exports = function (controller) {

    var getFile = function (inputFile) {
        var files = inputFile.get(0).files;
        if (!files.length) {
            throw "Selecione um arquivo!";
        }

        var file = files.item(0);
        if (!TEST_BAN_EXTENSION.test(file.name)) {
            throw "A extensão recebida do arquivo não confere!";
        }
        return file;
    };

    controller.registerCall("icheques::fidc", function () {

        var modal = controller.call("modal");

        modal.title("iCheques");
        modal.subtitle("Safekeeping para Carteiras de Cheque");
        modal.addParagraph("Para realizar a verificação de cheques em tempo real será necessário que você selecione o arquivo abaixo.");

        var form = modal.createForm();
        var inputFile = form.addInput("fidc-file", "file", "Selecionar arquivo.", {}, "Arquivo de Fundo FIDC");

        form.addSubmit("submit", "Enviar").click(function (e) {
            e.preventDefault();
            try {
                controller.call("icheques::fidc::enter", getFile(inputFile));
                modal.close();
            } catch (exception) {
                toastr.warning(exception);
                inputFile.addClass("error");
            }
        });

        form.cancelButton();

    });

    controller.registerCall("icheques::fidc::enter", function (file) {
        fileReaderStream(file).pipe(concat(function (buffer) {
            var lines = buffer.toString().split("\r\n");
            readExtension[TEST_BAN_EXTENSION.exec(file.name)[1].toLowerCase()](lines, file.name);
        }));
    });

    var readBan = function (lines, fileName) {
        var storage = [],
            runCount = 0;
        for (var key = 1; key < lines.length - 2; key++) {
            if (lines[key][0] == "E") {
                continue;
            }
            if (++runCount % 2 !== 0) {
                continue;
            }

            var expire = moment(lines[key - 1].substring(249, 249 + 6), "DDMMYY");

            var data = {
                expire: (expire.isValid() ? expire : moment().add(5, 'months')).format("YYYYMMDD"),
                cmc: lines[key].substring(34, 34 + 32).trim().replace(/[^\d]/g, ""),
                observation: fileName
            }, document = lines[key - 1].substring(17, 17 + 14).trim();

            if (!data.cmc || !new CMC7Validator(data.cmc).isValid()) {
                runCount--;
                continue;
            }
            data[CPF.isValid(document) ? "cpf" : "cnpj"] = document;
            storage.push(data);
        }
        controller.call("icheques::checkout", storage);
    };

    var alertRem = function (lines, fileName) {
            controller.confirm({
                title: "A extensão é TXT mas será tratada como REM.",
                subtitle: "Se o arquivo não for REM esta ação pode ocasionar problemas na inserção.",
                paragraph: "Se não tiver certeza do que está fazendo verifique o arquivo e tente novamente mais tarde."
            }, () => {
                readRem(lines, fileName);
            });
    };

    var readRem = function (lines, fileName) {
        var storage = [];
        for (var key = 1; key < lines.length - 2; key++) {
            var expire = moment(lines[key].substring(120, 120 + 6), "DDMMYY");
            var data = {
                cmc: lines[key].substring(351, 351 + 30),
                expire: (expire.isValid() ? expire : moment().add(5, 'months')).format("YYYYMMDD"),
                ammount: parseInt(lines[key].substring(180, 192).replace(/^0+/, ''), 10),
                observation: fileName
            };

            var document = lines[key].substring(220, 220 + 14);

            if (CPF.isValid(document.substring(3))) {
                data.cpf = document.substring(3);
            } else {
                data.cnpj = document;
            }

            storage.push(data);
        }


        controller.call("icheques::checkout", storage);
    };

    var readExtension = {
        ban: readBan,
        rem: readRem,
        txt: alertRem
    };

};
