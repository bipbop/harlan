/* global module */
var CreateList = require('./create-list');

module.exports = function(instance, controller) {

    var form = $('<form />');
    instance.element().append(form);

    var createLabel = function(input, obj, labelText, placeholder) {
        obj = obj || {};

        input.addClass('has-label').attr('id', (obj.id = require('node-uuid').v4()));

        if (obj.hoverHelp) {
            labelText += ' <a href="#" class=\'help\'>(Ajuda)</a>';
        }

        obj.label = $('<label />')
            .addClass('input-label')
            .attr({
                'for': obj.id,
                'title': obj.hoverHelp
            })
            .html(labelText || placeholder);

        if (obj.class) {
            obj.label.addClass(obj.class);
            input.addClass(obj.class);
        }

        if (controller.confs.isPhone) {
            /* no multi field */
            obj.labelPosition = controller.confs.phoneLabelPosition || 'after';
        }

        input[obj.labelPosition || 'after'](obj.label);
        input.parent().trigger('new-label');
    };

    this.multiField = function() {
        if (controller.confs.isPhone) {
            return form;
        }

        let div = $('<div />').addClass('multi-field');
        div.on('new-label', () => {
            let items = $('.input-label', div);
            for (let i = 0; i < items.length; i++) {
                let item = items.eq(i);
                item.css('left', `${i * (100 / items.length)}%`);
            }
        });
        form.append(div);
        return div;
    };

    this.addSelect = function(id, name, list, obj, labelText, value) {

        obj = obj || {};

        var select = $('<select />').attr({
            id: id,
            name: name,
            title: obj.hoverHelp
        });

        obj.options = {};
        for (var i in list) {
            obj.options[i] = select.append($('<option />').attr({
                value: i
            }).text(list[i]));
        }

        if (value) {
            select.val(value);
        }

        (obj.append || form).append(select);
        createLabel(select, obj, labelText);

        return select;
    };

    this.createList = function() {
        return new CreateList(form);
    };

    this.addTextarea = function(name, placeholder, obj, labelText, value) {
        obj = obj || {};

        var input = $('<textarea />').attr({
            name: name,
            placeholder: placeholder,
            autocomplete: false,
            autocapitalize: false,
            title: obj.hoverHelp
        }).text(value);

        (obj.append || form).append(input);
        createLabel(input, obj, labelText, placeholder);

        return input;
    };

    this.addInput = function(name, type, placeholder, obj, labelText, value) {
        obj = obj || {};

        var input = $('<input />').attr({
            name: name,
            type: type,
            placeholder: placeholder,
            autocomplete: false,
            autocapitalize: false,
            value: value,
            title: obj.hoverHelp
        });

        (obj.append || form).append(input);
        if (labelText !== false) {
            createLabel(input, obj, labelText, placeholder);
        }

        return input;
    };

    this.cancelButton = function(text, onCancel) {
        return this.addSubmit('cancel', text || controller.i18n.system.cancel()).click(function(e) {
            e.preventDefault();
            if (onCancel) {
                onCancel();
            } else {
                instance.close();
            }
        });
    };

    this.addCheckbox = function(name, label, checked, value, item) {
        var elementId = require('node-uuid').v4();
        item = item || {};

        var checkbox = $('<input />').attr({
            type: 'checkbox',
            checked: checked,
            value: (typeof value === 'undefined' ? '1' : value),
            id: elementId,
            title: item.hoverHelp
        });

        var lblItem;
        var div = $('<div />')
            .addClass('checkbox')
            .append(checkbox)
            .append(lblItem = $('<label/>').attr('for', elementId).html(label));

        (item.append || form).append(div);
        return [div, checkbox, lblItem];
    };

    this.addSubmit = function(name, value) {
        var submit = $('<input />').attr({
            type: 'submit',
            value: value,
            name: name
        }).addClass('button');

        form.append(submit);
        return submit;
    };

    this.element = function() {
        return form;
    };

    return this;
};
