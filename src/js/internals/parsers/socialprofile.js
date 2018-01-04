import _ from 'underscore';

module.exports = function(controller) {

    var parsePhoto = function(result, document) {
        var photos = [];

        document.find('BPQL > body photos > url').each(function(idx, node) {
            photos.push($(node).text());
        });

        document.find('*[profileImage]').each(function(node) {
            photos.push($(node).attr('profileImage'));
        });

        if (!photos.length)
            return;

        result.addItem().addClass('photo').css('background-image', 'url(' + photos[0] + ')');
    };

    var socialNetwork = function(result, jdocument) {
        var profiles = jdocument.find('BPQL > body socialProfiles > socialProfiles');

        if (!profiles.length) {
            return;
        }

        result.addSeparator('Redes Sociais', 'Perfis na Internet', 'Referência de perfis sociais');
        profiles.each(function(idx, node) {
            var jnode = $(node);
            var element = result.addItem('Perfil', jnode.find('typeName').text());
            element.prepend($('<a />').attr({
                target: '_blank',
                href: jnode.find('url').text(),
                title: 'typeName'
            }).append(element.find('.value')));
        });
    };

    var setContact = function(result, jdocument) {
        var phones = [];
        var emails = [];

        jdocument.find('BPQL > body > phones > phone:lt(3)').each(function(idx, node) {
            var jnode = $(node);
            phones.push('(' + jnode.find('area-code').text() + ') ' + jnode.find('number').text());
        });

        jdocument.find('BPQL > body email:lt(3)').each(function(idx, node) {
            emails.push($(node).text());
        });

        if (!phones.length && !emails.length) {
            return;
        }

        phones = _.uniq(phones);
        emails = _.uniq(emails);

        result.addSeparator('Contato', 'Meios de contato', 'Telefone, e-mail e outros');
        for (var idxPhones in phones) {
            result.addItem('Telefone', phones[idxPhones]);
        }

        for (var idxEmails in emails) {
            result.addItem('Email', emails[idxEmails]);
        }
    };

    var addMap = function(result, jdocument) {
        var address = [];

        result.block();

        jdocument.find('BPQL > body > addresses address').first().find('*').each(function(idx, node) {
            var jnode = $(node);
            if (!/(address|number|address-complement|bairro)/.test(jnode.prop('tagName')))
                address.push(jnode.text());
        });

        var width = window.innerWidth - 90;

        var mapUrl = 'http://maps.googleapis.com/maps/api/staticmap?' + $.param({
            'scale': '1',
            'size': (width < 120 ? 120 : width).toString() + 'x150',
            'maptype': 'roadmap',
            'format': 'png',
            'visual_refresh': 'true',
            'markers': 'size:mid|color:red|label:1|' + address.join(', ')
        });

        result.addItem('Localização Aproximada', '').addClass('map').find('.value').append(
            $('<a />').attr({
                'href': 'https://www.google.com/maps?' + $.param({
                    q: address.join(', ')
                }),
                'target': '_blank'
            }).append($('<img />').attr('src', mapUrl)));
    };

    controller.importXMLDocument.register('SOCIALPROFILE', 'CONSULTA', function(document) {
        var result = controller.call('result');
        var jdocument = $(document);

        parsePhoto(result, jdocument);

        var bio = null;
        var bioNode = jdocument.find('BPQL > body bio').first();
        if (bioNode.length) {
            bio = bioNode.text();
        }

        result.addItem(bio || 'Nome', jdocument.find('BPQL > body > name, BPQL > body> fullName').first().text());

        result.addItem('Idade Aproximada', jdocument.find('approximate-age').first().text()).addClass('center');
        result.addItem('Critério', jdocument.find('criteria').first().text()).addClass('center');

        result.addItem('Média E-commerce', 'R$' + jdocument.find('BPQL > body > buy-avg').text());
        result.addItem('Máximo E-commerce', 'R$' + jdocument.find('BPQL > body > buy-limit').text());
        result.block();

        result.generateRadial('Risco Social', parseInt(jdocument.find('BPQL > body > social-risk').text()));
        result.generateRadial('Influência', parseInt(jdocument.find('BPQL > body > influence').text()));
        result.generateRadial('Risco Jurídico', parseInt(jdocument.find('BPQL > body > juridic-risk').text()));
        result.generateRadial('Confiança', parseInt(jdocument.find('BPQL > body > confidence').text()), {
            0: 'warning',
            50: 'attention',
            70: null
        });

        addMap(result, jdocument);
        setContact(result, jdocument);
        socialNetwork(result, jdocument);

        return result.element();
    });

};
