module.exports = controller => {

    const xmlDocument = (document, database, table) => {
        const htmlNode = controller.importXMLDocument.import(document, database, table);

        const fnc = function (e) {
            e.preventDefault();
            const result = $(this);
            result[`${result.hasClass('selected') ? 'remove' : 'add'}Class`]('selected');
        };
        htmlNode.on('doubletap', fnc);
        return htmlNode;

    };

    controller.registerCall('xmlDocument', (document, database, table) => xmlDocument(document, database, table));
};
