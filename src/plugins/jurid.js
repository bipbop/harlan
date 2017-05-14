/* global controller, numeral, Infinity, NaN, moment */
harlan.addPlugin((controller) => {

    const MAX_RESULTS = 10;
    const REGEX_TRIBUNAL = /SELECT\s+FROM\s+'([^']*)'\.'([^']*)'/i;
    const REGEX_SIGLA = /\'sigla\'\s*=\s*'([^']*)'/i;
    const REGEX_PARAMETER = /\'(numero_oab|processo|)\'\s*=\s*'([^']*)'/i;

    controller.trigger("projuris::init");
    require("./styles/projuris.js");

    controller.registerCall("loader::catchElement", function() {
        return [];
    });

    $("title").text("Teste @ SOFTWARE JURIDICO");
    $(".actions .container").prepend($("<div />").addClass("content support-phone").text("(xx) xxxx-xxxx (Suporte)").prepend($("<i />").addClass("fa fa-phone")));

    var skip = 0;
    controller.serverCommunication.call("SELECT FROM 'PUSHJURISTEK'.'REPORT'", controller.call("loader::ajax", {
        data: {
            limit: MAX_RESULTS,
            skip: skip
        },
        success: function(document) {

            var section = controller.call("section",
                "Processos Cadastrados",
                "Processos jurídicos acompanhados no sistema",
                "Créditos disponíveis e extrato");
            var jdocument = $(document);
            var result = controller.call("result");

            section[1].append(result.element());
            $(".app-content").append(section[0]);

            result.addItem("Usuário", jdocument.find("BPQL > body > username").text());

            var credits = parseInt(jdocument.find("BPQL > body > limit").text());
            var usedCredits = parseInt(jdocument.find("BPQL > body > total").text());
            var perc = (usedCredits / credits) * 100;

            if (perc == Infinity || isNaN(perc)) {
                perc = 0;
            }

            result.addItem("Créditos Contratados", numeral(credits).format('0,')).addClass("center");
            result.addItem("Créditos Utilizados", numeral(usedCredits).format('0,')).addClass("center");

            var radial = controller.interface.widgets.radialProject(result.addItem(null, "").addClass("center").find(".value"), perc);

            if (perc > 0.8) {
                radial.element.addClass("warning animated flash");
            } else if (perc > 0.6) {
                radial.element.addClass("attention animated flash");
            }

            var moreResults = controller.call("moreResults", MAX_RESULTS).callback((callback) => {
                skip += MAX_RESULTS;
                controller.serverCommunication.call("SELECT FROM 'PUSHJURISTEK'.'REPORT'",
                    controller.call("loader::ajax", controller.call("error::ajax", {
                        data: {
                            limit: MAX_RESULTS,
                            skip: skip
                        },
                        success: (response) => {
                            var items = [];
                            $("BPQL > body push", response).each((idx, node) => {
                                items.push(controller.call("projuris::parseResult", node));
                            });
                            callback(items);
                        }
                    })));
            });

            moreResults.element().insertAfter(result.element());

            let pushs = jdocument.find("BPQL > body push");
            if (pushs.length) {
                result.addSeparator("Extrato de Processos", "Processos Realizados", usedCredits === 1 ?
                    "1 processo" : numeral(usedCredits).format('0,') + " processos");

                pushs.each((idx, node) => {
                    moreResults.append(controller.call("projuris::parseResult", node));
                });
            }

            moreResults.show();
        }
    }));

    controller.registerCall("projuris::parseResult", (node) => {
        var jnode = $(node);
        var resultNode = controller.call("result");
        resultNode.addItem("Título", jnode.attr("label"));
        resultNode.addItem("Versão", jnode.attr("version") || "0").addClass("center");
        resultNode.addItem("Criação", moment(jnode.attr("created")).format('L')).addClass("center").addClass("center");
        resultNode.addItem("Atualização", moment(jnode.attr("nextJob")).fromNow());

        var sigla = jnode.find("data").text().match(REGEX_SIGLA);
        if (sigla) {
            resultNode.addItem("Sigla", sigla[1]);
        }

        var tribunal = jnode.find("data").text().match(REGEX_TRIBUNAL);
        if (tribunal) {
            resultNode.addItem(tribunal[1], tribunal[2]).css("width", "20%");
        }

        var parameter = jnode.find("data").text().match(REGEX_PARAMETER);
        if (parameter) {
            resultNode.addItem(parameter[1], parameter[2]);
        }

        return resultNode.element().addClass("table");
    });

});
