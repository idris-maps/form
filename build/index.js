(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.form = factory());
}(this, (function () { 'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    const isCheckbox = (d) => d.type === 'checkbox';
    const isColor = (d) => d.type === 'color';
    const isDate = (d) => d.type === 'date';
    const isEmail = (d) => d.type === 'email';
    const isNumber = (d) => d.type === 'number';
    const isPassword = (d) => d.type === 'password';
    const isRadio = (d) => d.type === 'radio';
    const isRange = (d) => d.type === 'range';
    const isTel = (d) => d.type === 'tel';
    const isText = (d) => d.type === 'text';
    const isTextarea = (d) => d.type === 'textarea';
    const isSelect = (d) => d.type === 'select';
    const isTextField = (d) => isEmail(d) || isPassword(d) || isTel(d) || isText(d);
    const isSelectOption = (d) => d && !(typeof d === 'string');
    const isSelectOptions = (d) => 
    // @ts-ignore
    d && d.every(isSelectOption);

    const getInitialData = (fields) => fields.reduce((result, field) => {
        if (isCheckbox(field)) {
            return Object.assign(Object.assign({}, result), { [field.property]: Boolean(field.value) });
        }
        if (isRadio(field) || isSelect(field)) {
            return Object.assign(Object.assign({}, result), { [field.property]: field.value
                    ? field.value
                    : isSelectOptions(field.options)
                        ? field.options[0].value
                        : field.options[0] });
        }
        if (isRange(field) && !field.notRequired) {
            return Object.assign(Object.assign({}, result), { [field.property]: field.value || field.min });
        }
        if (field.value) {
            return Object.assign(Object.assign({}, result), { [field.property]: field.value });
        }
        return result;
    }, {});
    const request = async (data, submitAction) => {
        const { method, data: where, url, headers } = submitAction;
        const query = where === 'query'
            ? `?${new URLSearchParams(data).toString()}`
            : '';
        const res = await fetch(`${url}${query}`, {
            method,
            headers: Object.assign({ 'Content-Type': 'application/json' }, (headers || {})),
            body: where === 'query'
                ? undefined
                : JSON.stringify(data)
        });
        if (res.status >= 400) {
            throw new Error(`status: ${res.status}`);
        }
        return await res.json();
    };

    /* src/components/Checkbox.svelte generated by Svelte v3.29.0 */

    function create_fragment(ctx) {
    	let div;
    	let label;
    	let t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "";
    	let t0;
    	let label_for_value;
    	let t1;
    	let input;
    	let input_id_value;
    	let input_name_value;
    	let input_checked_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			input = element("input");
    			attr(label, "for", label_for_value = /*field*/ ctx[0].property);
    			attr(input, "type", "checkbox");
    			attr(input, "id", input_id_value = /*field*/ ctx[0].property);
    			attr(input, "name", input_name_value = /*field*/ ctx[0].property);
    			input.checked = input_checked_value = /*field*/ ctx[0].value;
    			attr(div, "class", "field checkbox-field");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(label, t0);
    			append(div, t1);
    			append(div, input);

    			if (!mounted) {
    				dispose = listen(input, "change", /*change_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*field*/ 1 && t0_value !== (t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "")) set_data(t0, t0_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*field*/ ctx[0].property)) {
    				attr(label, "for", label_for_value);
    			}

    			if (dirty & /*field*/ 1 && input_id_value !== (input_id_value = /*field*/ ctx[0].property)) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*field*/ 1 && input_name_value !== (input_name_value = /*field*/ ctx[0].property)) {
    				attr(input, "name", input_name_value);
    			}

    			if (dirty & /*field*/ 1 && input_checked_value !== (input_checked_value = /*field*/ ctx[0].value)) {
    				input.checked = input_checked_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	
    	let { field } = $$props;
    	let { onChange } = $$props;
    	let checked = field.value;

    	const change_handler = () => {
    		$$invalidate(2, checked = !checked);
    		onChange(field.property, checked);
    	};

    	$$self.$$set = $$props => {
    		if ("field" in $$props) $$invalidate(0, field = $$props.field);
    		if ("onChange" in $$props) $$invalidate(1, onChange = $$props.onChange);
    	};

    	return [field, onChange, checked, change_handler];
    }

    class Checkbox extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { field: 0, onChange: 1 });
    	}
    }

    /* src/components/Color.svelte generated by Svelte v3.29.0 */

    function create_fragment$1(ctx) {
    	let div;
    	let label;
    	let t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "";
    	let t0;
    	let label_for_value;
    	let t1;
    	let input;
    	let input_id_value;
    	let input_name_value;
    	let input_required_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			input = element("input");
    			attr(label, "for", label_for_value = /*field*/ ctx[0].property);
    			attr(input, "type", "color");
    			attr(input, "id", input_id_value = /*field*/ ctx[0].property);
    			attr(input, "name", input_name_value = /*field*/ ctx[0].property);
    			input.value = /*value*/ ctx[2];
    			input.required = input_required_value = !/*field*/ ctx[0].notRequired;
    			attr(div, "class", "field color-field");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(label, t0);
    			append(div, t1);
    			append(div, input);

    			if (!mounted) {
    				dispose = listen(input, "change", /*change_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*field*/ 1 && t0_value !== (t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "")) set_data(t0, t0_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*field*/ ctx[0].property)) {
    				attr(label, "for", label_for_value);
    			}

    			if (dirty & /*field*/ 1 && input_id_value !== (input_id_value = /*field*/ ctx[0].property)) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*field*/ 1 && input_name_value !== (input_name_value = /*field*/ ctx[0].property)) {
    				attr(input, "name", input_name_value);
    			}

    			if (dirty & /*value*/ 4) {
    				input.value = /*value*/ ctx[2];
    			}

    			if (dirty & /*field*/ 1 && input_required_value !== (input_required_value = !/*field*/ ctx[0].notRequired)) {
    				input.required = input_required_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	
    	let { field } = $$props;
    	let { onChange } = $$props;
    	let value = field.value;

    	const change_handler = e => {
    		$$invalidate(2, value = e.currentTarget.value);
    		onChange(field.property, value);
    	};

    	$$self.$$set = $$props => {
    		if ("field" in $$props) $$invalidate(0, field = $$props.field);
    		if ("onChange" in $$props) $$invalidate(1, onChange = $$props.onChange);
    	};

    	return [field, onChange, value, change_handler];
    }

    class Color extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { field: 0, onChange: 1 });
    	}
    }

    /* src/components/Date.svelte generated by Svelte v3.29.0 */

    function create_fragment$2(ctx) {
    	let div;
    	let label;
    	let t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "";
    	let t0;
    	let label_for_value;
    	let t1;
    	let input;
    	let input_id_value;
    	let input_name_value;
    	let input_min_value;
    	let input_max_value;
    	let input_required_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			input = element("input");
    			attr(label, "for", label_for_value = /*field*/ ctx[0].property);
    			attr(input, "type", "date");
    			attr(input, "id", input_id_value = /*field*/ ctx[0].property);
    			attr(input, "name", input_name_value = /*field*/ ctx[0].property);
    			input.value = /*value*/ ctx[2];
    			attr(input, "min", input_min_value = /*field*/ ctx[0].min);
    			attr(input, "max", input_max_value = /*field*/ ctx[0].max);
    			input.required = input_required_value = !/*field*/ ctx[0].notRequired;
    			attr(div, "class", "field date-field");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(label, t0);
    			append(div, t1);
    			append(div, input);

    			if (!mounted) {
    				dispose = listen(input, "change", /*change_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*field*/ 1 && t0_value !== (t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "")) set_data(t0, t0_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*field*/ ctx[0].property)) {
    				attr(label, "for", label_for_value);
    			}

    			if (dirty & /*field*/ 1 && input_id_value !== (input_id_value = /*field*/ ctx[0].property)) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*field*/ 1 && input_name_value !== (input_name_value = /*field*/ ctx[0].property)) {
    				attr(input, "name", input_name_value);
    			}

    			if (dirty & /*value*/ 4) {
    				input.value = /*value*/ ctx[2];
    			}

    			if (dirty & /*field*/ 1 && input_min_value !== (input_min_value = /*field*/ ctx[0].min)) {
    				attr(input, "min", input_min_value);
    			}

    			if (dirty & /*field*/ 1 && input_max_value !== (input_max_value = /*field*/ ctx[0].max)) {
    				attr(input, "max", input_max_value);
    			}

    			if (dirty & /*field*/ 1 && input_required_value !== (input_required_value = !/*field*/ ctx[0].notRequired)) {
    				input.required = input_required_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	
    	let { field } = $$props;
    	let { onChange } = $$props;
    	let value = field.value;

    	const change_handler = e => {
    		$$invalidate(2, value = e.currentTarget.value);
    		onChange(field.property, value);
    	};

    	$$self.$$set = $$props => {
    		if ("field" in $$props) $$invalidate(0, field = $$props.field);
    		if ("onChange" in $$props) $$invalidate(1, onChange = $$props.onChange);
    	};

    	return [field, onChange, value, change_handler];
    }

    class Date extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { field: 0, onChange: 1 });
    	}
    }

    /* src/components/Text.svelte generated by Svelte v3.29.0 */

    function create_fragment$3(ctx) {
    	let div;
    	let label;
    	let t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "";
    	let t0;
    	let label_for_value;
    	let t1;
    	let input;
    	let input_type_value;
    	let input_id_value;
    	let input_name_value;
    	let input_minlength_value;
    	let input_maxlength_value;
    	let input_pattern_value;
    	let input_required_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			input = element("input");
    			attr(label, "for", label_for_value = /*field*/ ctx[0].property);
    			attr(input, "type", input_type_value = /*field*/ ctx[0].type);
    			attr(input, "id", input_id_value = /*field*/ ctx[0].property);
    			attr(input, "name", input_name_value = /*field*/ ctx[0].property);
    			input.value = /*value*/ ctx[2];
    			attr(input, "minlength", input_minlength_value = /*field*/ ctx[0].minLength);
    			attr(input, "maxlength", input_maxlength_value = /*field*/ ctx[0].maxLength);
    			attr(input, "pattern", input_pattern_value = /*field*/ ctx[0].pattern);
    			input.required = input_required_value = !/*field*/ ctx[0].notRequired;
    			attr(div, "class", "field text-field");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(label, t0);
    			append(div, t1);
    			append(div, input);

    			if (!mounted) {
    				dispose = listen(input, "keyup", /*keyup_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*field*/ 1 && t0_value !== (t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "")) set_data(t0, t0_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*field*/ ctx[0].property)) {
    				attr(label, "for", label_for_value);
    			}

    			if (dirty & /*field*/ 1 && input_type_value !== (input_type_value = /*field*/ ctx[0].type)) {
    				attr(input, "type", input_type_value);
    			}

    			if (dirty & /*field*/ 1 && input_id_value !== (input_id_value = /*field*/ ctx[0].property)) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*field*/ 1 && input_name_value !== (input_name_value = /*field*/ ctx[0].property)) {
    				attr(input, "name", input_name_value);
    			}

    			if (dirty & /*value*/ 4 && input.value !== /*value*/ ctx[2]) {
    				input.value = /*value*/ ctx[2];
    			}

    			if (dirty & /*field*/ 1 && input_minlength_value !== (input_minlength_value = /*field*/ ctx[0].minLength)) {
    				attr(input, "minlength", input_minlength_value);
    			}

    			if (dirty & /*field*/ 1 && input_maxlength_value !== (input_maxlength_value = /*field*/ ctx[0].maxLength)) {
    				attr(input, "maxlength", input_maxlength_value);
    			}

    			if (dirty & /*field*/ 1 && input_pattern_value !== (input_pattern_value = /*field*/ ctx[0].pattern)) {
    				attr(input, "pattern", input_pattern_value);
    			}

    			if (dirty & /*field*/ 1 && input_required_value !== (input_required_value = !/*field*/ ctx[0].notRequired)) {
    				input.required = input_required_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	
    	let { field } = $$props;
    	let { onChange } = $$props;
    	let value = field.value || "";

    	const keyup_handler = e => {
    		$$invalidate(2, value = e.currentTarget.value);
    		onChange(field.property, value);
    	};

    	$$self.$$set = $$props => {
    		if ("field" in $$props) $$invalidate(0, field = $$props.field);
    		if ("onChange" in $$props) $$invalidate(1, onChange = $$props.onChange);
    	};

    	return [field, onChange, value, keyup_handler];
    }

    class Text extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { field: 0, onChange: 1 });
    	}
    }

    /* src/components/Number.svelte generated by Svelte v3.29.0 */

    function create_fragment$4(ctx) {
    	let div;
    	let label;
    	let t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "";
    	let t0;
    	let label_for_value;
    	let t1;
    	let input;
    	let input_id_value;
    	let input_name_value;
    	let input_min_value;
    	let input_max_value;
    	let input_step_value;
    	let input_required_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			input = element("input");
    			attr(label, "for", label_for_value = /*field*/ ctx[0].property);
    			attr(input, "type", "number");
    			attr(input, "id", input_id_value = /*field*/ ctx[0].property);
    			attr(input, "name", input_name_value = /*field*/ ctx[0].property);
    			input.value = /*value*/ ctx[2];
    			attr(input, "min", input_min_value = /*field*/ ctx[0].min);
    			attr(input, "max", input_max_value = /*field*/ ctx[0].max);
    			attr(input, "step", input_step_value = /*field*/ ctx[0].step);
    			input.required = input_required_value = !/*field*/ ctx[0].notRequired;
    			attr(div, "class", "field number-field");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(label, t0);
    			append(div, t1);
    			append(div, input);

    			if (!mounted) {
    				dispose = [
    					listen(input, "keyup", /*keyup_handler*/ ctx[3]),
    					listen(input, "change", /*change_handler*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*field*/ 1 && t0_value !== (t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "")) set_data(t0, t0_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*field*/ ctx[0].property)) {
    				attr(label, "for", label_for_value);
    			}

    			if (dirty & /*field*/ 1 && input_id_value !== (input_id_value = /*field*/ ctx[0].property)) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*field*/ 1 && input_name_value !== (input_name_value = /*field*/ ctx[0].property)) {
    				attr(input, "name", input_name_value);
    			}

    			if (dirty & /*value*/ 4) {
    				input.value = /*value*/ ctx[2];
    			}

    			if (dirty & /*field*/ 1 && input_min_value !== (input_min_value = /*field*/ ctx[0].min)) {
    				attr(input, "min", input_min_value);
    			}

    			if (dirty & /*field*/ 1 && input_max_value !== (input_max_value = /*field*/ ctx[0].max)) {
    				attr(input, "max", input_max_value);
    			}

    			if (dirty & /*field*/ 1 && input_step_value !== (input_step_value = /*field*/ ctx[0].step)) {
    				attr(input, "step", input_step_value);
    			}

    			if (dirty & /*field*/ 1 && input_required_value !== (input_required_value = !/*field*/ ctx[0].notRequired)) {
    				input.required = input_required_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	
    	let { field } = $$props;
    	let { onChange } = $$props;
    	let value = field.value;

    	const keyup_handler = e => {
    		const v = Number(e.currentTarget.value);

    		if (!Number.isNaN(v)) {
    			$$invalidate(2, value = v);
    			onChange(field.property, value);
    		}
    	};

    	const change_handler = e => {
    		const v = Number(e.currentTarget.value);

    		if (!Number.isNaN(v)) {
    			$$invalidate(2, value = v);
    			onChange(field.property, value);
    		}
    	};

    	$$self.$$set = $$props => {
    		if ("field" in $$props) $$invalidate(0, field = $$props.field);
    		if ("onChange" in $$props) $$invalidate(1, onChange = $$props.onChange);
    	};

    	return [field, onChange, value, keyup_handler, change_handler];
    }

    class Number_1 extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { field: 0, onChange: 1 });
    	}
    }

    /* src/components/Radio.svelte generated by Svelte v3.29.0 */

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (28:2) {:else}
    function create_else_block(ctx) {
    	let each_1_anchor;
    	let each_value_1 = /*field*/ ctx[0].options;
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*field, value, onChange*/ 7) {
    				each_value_1 = /*field*/ ctx[0].options;
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (11:2) {#if isSelectOptions(field.options)}
    function create_if_block(ctx) {
    	let each_1_anchor;
    	let each_value = /*field*/ ctx[0].options;
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*field, value, onChange*/ 7) {
    				each_value = /*field*/ ctx[0].options;
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (29:4) {#each field.options as option}
    function create_each_block_1(ctx) {
    	let div;
    	let input;
    	let input_id_value;
    	let input_name_value;
    	let input_value_value;
    	let input_checked_value;
    	let t0;
    	let label;
    	let t1_value = /*option*/ ctx[5] + "";
    	let t1;
    	let label_for_value;
    	let t2;
    	let mounted;
    	let dispose;

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[4](/*option*/ ctx[5], ...args);
    	}

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			label = element("label");
    			t1 = text(t1_value);
    			t2 = space();
    			attr(input, "type", "radio");
    			attr(input, "id", input_id_value = /*option*/ ctx[5]);
    			attr(input, "name", input_name_value = /*field*/ ctx[0].property);
    			input.value = input_value_value = /*option*/ ctx[5];
    			input.checked = input_checked_value = /*option*/ ctx[5] === /*value*/ ctx[2];
    			attr(label, "for", label_for_value = /*option*/ ctx[5]);
    			attr(div, "class", "radio-field-option");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			append(div, t0);
    			append(div, label);
    			append(label, t1);
    			append(div, t2);

    			if (!mounted) {
    				dispose = listen(input, "click", click_handler_1);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*field*/ 1 && input_id_value !== (input_id_value = /*option*/ ctx[5])) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*field*/ 1 && input_name_value !== (input_name_value = /*field*/ ctx[0].property)) {
    				attr(input, "name", input_name_value);
    			}

    			if (dirty & /*field*/ 1 && input_value_value !== (input_value_value = /*option*/ ctx[5])) {
    				input.value = input_value_value;
    			}

    			if (dirty & /*field, value*/ 5 && input_checked_value !== (input_checked_value = /*option*/ ctx[5] === /*value*/ ctx[2])) {
    				input.checked = input_checked_value;
    			}

    			if (dirty & /*field*/ 1 && t1_value !== (t1_value = /*option*/ ctx[5] + "")) set_data(t1, t1_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*option*/ ctx[5])) {
    				attr(label, "for", label_for_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (12:4) {#each field.options as option}
    function create_each_block(ctx) {
    	let div;
    	let input;
    	let input_id_value;
    	let input_name_value;
    	let input_value_value;
    	let input_checked_value;
    	let t0;
    	let label;
    	let t1_value = /*option*/ ctx[5].label + "";
    	let t1;
    	let label_for_value;
    	let t2;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[3](/*option*/ ctx[5], ...args);
    	}

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			label = element("label");
    			t1 = text(t1_value);
    			t2 = space();
    			attr(input, "type", "radio");
    			attr(input, "id", input_id_value = /*option*/ ctx[5].value);
    			attr(input, "name", input_name_value = /*field*/ ctx[0].property);
    			input.value = input_value_value = /*option*/ ctx[5].value;
    			input.checked = input_checked_value = /*option*/ ctx[5].value === /*value*/ ctx[2];
    			attr(label, "for", label_for_value = /*option*/ ctx[5].value);
    			attr(div, "class", "radio-field-option");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			append(div, t0);
    			append(div, label);
    			append(label, t1);
    			append(div, t2);

    			if (!mounted) {
    				dispose = listen(input, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*field*/ 1 && input_id_value !== (input_id_value = /*option*/ ctx[5].value)) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*field*/ 1 && input_name_value !== (input_name_value = /*field*/ ctx[0].property)) {
    				attr(input, "name", input_name_value);
    			}

    			if (dirty & /*field*/ 1 && input_value_value !== (input_value_value = /*option*/ ctx[5].value)) {
    				input.value = input_value_value;
    			}

    			if (dirty & /*field, value*/ 5 && input_checked_value !== (input_checked_value = /*option*/ ctx[5].value === /*value*/ ctx[2])) {
    				input.checked = input_checked_value;
    			}

    			if (dirty & /*field*/ 1 && t1_value !== (t1_value = /*option*/ ctx[5].label + "")) set_data(t1, t1_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*option*/ ctx[5].value)) {
    				attr(label, "for", label_for_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	let div;
    	let label;
    	let t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "";
    	let t0;
    	let label_for_value;
    	let t1;
    	let show_if;

    	function select_block_type(ctx, dirty) {
    		if (show_if == null || dirty & /*field*/ 1) show_if = !!isSelectOptions(/*field*/ ctx[0].options);
    		if (show_if) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx, -1);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			if_block.c();
    			attr(label, "class", "radio-label");
    			attr(label, "for", label_for_value = /*field*/ ctx[0].property);
    			attr(div, "class", "field radio-field");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(label, t0);
    			append(div, t1);
    			if_block.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*field*/ 1 && t0_value !== (t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "")) set_data(t0, t0_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*field*/ ctx[0].property)) {
    				attr(label, "for", label_for_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if_block.d();
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	
    	let { field } = $$props;
    	let { onChange } = $$props;

    	let value = field.value || (isSelectOptions(field.options)
    	? field.options[0].value
    	: field.options[0]);

    	const click_handler = option => {
    		$$invalidate(2, value = option.value);
    		onChange(field.property, value);
    	};

    	const click_handler_1 = option => {
    		$$invalidate(2, value = option);
    		onChange(field.property, value);
    	};

    	$$self.$$set = $$props => {
    		if ("field" in $$props) $$invalidate(0, field = $$props.field);
    		if ("onChange" in $$props) $$invalidate(1, onChange = $$props.onChange);
    	};

    	return [field, onChange, value, click_handler, click_handler_1];
    }

    class Radio extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { field: 0, onChange: 1 });
    	}
    }

    /* src/components/Range.svelte generated by Svelte v3.29.0 */

    function create_if_block$1(ctx) {
    	let span;
    	let t;

    	return {
    		c() {
    			span = element("span");
    			t = text(/*value*/ ctx[2]);
    			attr(span, "class", "range-value");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*value*/ 4) set_data(t, /*value*/ ctx[2]);
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	let div;
    	let label;
    	let t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "";
    	let t0;
    	let label_for_value;
    	let t1;
    	let input;
    	let input_id_value;
    	let input_name_value;
    	let input_min_value;
    	let input_max_value;
    	let input_step_value;
    	let input_required_value;
    	let t2;
    	let mounted;
    	let dispose;
    	let if_block = /*value*/ ctx[2] && create_if_block$1(ctx);

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			if (if_block) if_block.c();
    			attr(label, "for", label_for_value = /*field*/ ctx[0].property);
    			attr(input, "type", "range");
    			attr(input, "id", input_id_value = /*field*/ ctx[0].property);
    			attr(input, "name", input_name_value = /*field*/ ctx[0].property);
    			input.value = /*value*/ ctx[2];
    			attr(input, "min", input_min_value = /*field*/ ctx[0].min);
    			attr(input, "max", input_max_value = /*field*/ ctx[0].max);
    			attr(input, "step", input_step_value = /*field*/ ctx[0].step);
    			input.required = input_required_value = !/*field*/ ctx[0].notRequired;
    			attr(div, "class", "field range-field");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(label, t0);
    			append(div, t1);
    			append(div, input);
    			append(div, t2);
    			if (if_block) if_block.m(div, null);

    			if (!mounted) {
    				dispose = listen(input, "input", /*input_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*field*/ 1 && t0_value !== (t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "")) set_data(t0, t0_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*field*/ ctx[0].property)) {
    				attr(label, "for", label_for_value);
    			}

    			if (dirty & /*field*/ 1 && input_id_value !== (input_id_value = /*field*/ ctx[0].property)) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*field*/ 1 && input_name_value !== (input_name_value = /*field*/ ctx[0].property)) {
    				attr(input, "name", input_name_value);
    			}

    			if (dirty & /*value*/ 4) {
    				input.value = /*value*/ ctx[2];
    			}

    			if (dirty & /*field*/ 1 && input_min_value !== (input_min_value = /*field*/ ctx[0].min)) {
    				attr(input, "min", input_min_value);
    			}

    			if (dirty & /*field*/ 1 && input_max_value !== (input_max_value = /*field*/ ctx[0].max)) {
    				attr(input, "max", input_max_value);
    			}

    			if (dirty & /*field*/ 1 && input_step_value !== (input_step_value = /*field*/ ctx[0].step)) {
    				attr(input, "step", input_step_value);
    			}

    			if (dirty & /*field*/ 1 && input_required_value !== (input_required_value = !/*field*/ ctx[0].notRequired)) {
    				input.required = input_required_value;
    			}

    			if (/*value*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$6($$self, $$props, $$invalidate) {
    	
    	let { field } = $$props;
    	let { onChange } = $$props;
    	let value = field.value || field.min;

    	const input_handler = e => {
    		const v = Number(e.currentTarget.value);

    		if (!Number.isNaN(v)) {
    			$$invalidate(2, value = v);
    			onChange(field.property, value);
    		}
    	};

    	$$self.$$set = $$props => {
    		if ("field" in $$props) $$invalidate(0, field = $$props.field);
    		if ("onChange" in $$props) $$invalidate(1, onChange = $$props.onChange);
    	};

    	return [field, onChange, value, input_handler];
    }

    class Range extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { field: 0, onChange: 1 });
    	}
    }

    /* src/components/Textarea.svelte generated by Svelte v3.29.0 */

    function create_fragment$7(ctx) {
    	let div;
    	let label;
    	let t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "";
    	let t0;
    	let label_for_value;
    	let t1;
    	let textarea;
    	let textarea_type_value;
    	let textarea_id_value;
    	let textarea_name_value;
    	let textarea_required_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			textarea = element("textarea");
    			attr(label, "for", label_for_value = /*field*/ ctx[0].property);
    			attr(textarea, "type", textarea_type_value = /*field*/ ctx[0].type);
    			attr(textarea, "id", textarea_id_value = /*field*/ ctx[0].property);
    			attr(textarea, "name", textarea_name_value = /*field*/ ctx[0].property);
    			textarea.value = /*value*/ ctx[2];
    			textarea.required = textarea_required_value = !/*field*/ ctx[0].notRequired;
    			attr(div, "class", "field text-field");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(label, t0);
    			append(div, t1);
    			append(div, textarea);

    			if (!mounted) {
    				dispose = listen(textarea, "keyup", /*keyup_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*field*/ 1 && t0_value !== (t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "")) set_data(t0, t0_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*field*/ ctx[0].property)) {
    				attr(label, "for", label_for_value);
    			}

    			if (dirty & /*field*/ 1 && textarea_type_value !== (textarea_type_value = /*field*/ ctx[0].type)) {
    				attr(textarea, "type", textarea_type_value);
    			}

    			if (dirty & /*field*/ 1 && textarea_id_value !== (textarea_id_value = /*field*/ ctx[0].property)) {
    				attr(textarea, "id", textarea_id_value);
    			}

    			if (dirty & /*field*/ 1 && textarea_name_value !== (textarea_name_value = /*field*/ ctx[0].property)) {
    				attr(textarea, "name", textarea_name_value);
    			}

    			if (dirty & /*value*/ 4) {
    				textarea.value = /*value*/ ctx[2];
    			}

    			if (dirty & /*field*/ 1 && textarea_required_value !== (textarea_required_value = !/*field*/ ctx[0].notRequired)) {
    				textarea.required = textarea_required_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$7($$self, $$props, $$invalidate) {
    	
    	let { field } = $$props;
    	let { onChange } = $$props;
    	let value = field.value || "";

    	const keyup_handler = e => {
    		$$invalidate(2, value = e.currentTarget.value);
    		onChange(field.property, value);
    	};

    	$$self.$$set = $$props => {
    		if ("field" in $$props) $$invalidate(0, field = $$props.field);
    		if ("onChange" in $$props) $$invalidate(1, onChange = $$props.onChange);
    	};

    	return [field, onChange, value, keyup_handler];
    }

    class Textarea extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { field: 0, onChange: 1 });
    	}
    }

    /* src/components/Select.svelte generated by Svelte v3.29.0 */

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (23:4) {:else}
    function create_else_block$1(ctx) {
    	let each_1_anchor;
    	let each_value_1 = /*field*/ ctx[0].options;
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*field*/ 1) {
    				each_value_1 = /*field*/ ctx[0].options;
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (19:4) {#if isSelectOptions(field.options)}
    function create_if_block$2(ctx) {
    	let each_1_anchor;
    	let each_value = /*field*/ ctx[0].options;
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*field*/ 1) {
    				each_value = /*field*/ ctx[0].options;
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (24:6) {#each field.options as option}
    function create_each_block_1$1(ctx) {
    	let option;
    	let t_value = /*option*/ ctx[4] + "";
    	let t;
    	let option_value_value;

    	return {
    		c() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*option*/ ctx[4];
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*field*/ 1 && t_value !== (t_value = /*option*/ ctx[4] + "")) set_data(t, t_value);

    			if (dirty & /*field*/ 1 && option_value_value !== (option_value_value = /*option*/ ctx[4])) {
    				option.__value = option_value_value;
    				option.value = option.__value;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (20:6) {#each field.options as option}
    function create_each_block$1(ctx) {
    	let option;
    	let t_value = /*option*/ ctx[4].label + "";
    	let t;
    	let option_value_value;

    	return {
    		c() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*option*/ ctx[4].value;
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*field*/ 1 && t_value !== (t_value = /*option*/ ctx[4].label + "")) set_data(t, t_value);

    			if (dirty & /*field*/ 1 && option_value_value !== (option_value_value = /*option*/ ctx[4].value)) {
    				option.__value = option_value_value;
    				option.value = option.__value;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    function create_fragment$8(ctx) {
    	let div;
    	let label;
    	let t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "";
    	let t0;
    	let label_for_value;
    	let t1;
    	let select;
    	let show_if;
    	let select_id_value;
    	let select_name_value;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (show_if == null || dirty & /*field*/ 1) show_if = !!isSelectOptions(/*field*/ ctx[0].options);
    		if (show_if) return create_if_block$2;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx, -1);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			select = element("select");
    			if_block.c();
    			attr(label, "for", label_for_value = /*field*/ ctx[0].property);
    			attr(select, "id", select_id_value = /*field*/ ctx[0].property);
    			attr(select, "name", select_name_value = /*field*/ ctx[0].property);
    			attr(div, "class", "field select-field");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(label, t0);
    			append(div, t1);
    			append(div, select);
    			if_block.m(select, null);
    			select_option(select, /*value*/ ctx[2]);

    			if (!mounted) {
    				dispose = listen(select, "input", /*input_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*field*/ 1 && t0_value !== (t0_value = (/*field*/ ctx[0].label || /*field*/ ctx[0].property) + "")) set_data(t0, t0_value);

    			if (dirty & /*field*/ 1 && label_for_value !== (label_for_value = /*field*/ ctx[0].property)) {
    				attr(label, "for", label_for_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(select, null);
    				}
    			}

    			if (dirty & /*field*/ 1 && select_id_value !== (select_id_value = /*field*/ ctx[0].property)) {
    				attr(select, "id", select_id_value);
    			}

    			if (dirty & /*field*/ 1 && select_name_value !== (select_name_value = /*field*/ ctx[0].property)) {
    				attr(select, "name", select_name_value);
    			}

    			if (dirty & /*value, field*/ 5) {
    				select_option(select, /*value*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$8($$self, $$props, $$invalidate) {
    	
    	let { field } = $$props;
    	let { onChange } = $$props;
    	let value = field.value;

    	const input_handler = e => {
    		$$invalidate(2, value = e.currentTarget.value);
    		onChange(field.property, value);
    	};

    	$$self.$$set = $$props => {
    		if ("field" in $$props) $$invalidate(0, field = $$props.field);
    		if ("onChange" in $$props) $$invalidate(1, onChange = $$props.onChange);
    	};

    	return [field, onChange, value, input_handler];
    }

    class Select extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { field: 0, onChange: 1 });
    	}
    }

    /* src/components/Field.svelte generated by Svelte v3.29.0 */

    function create_if_block_8(ctx) {
    	let select;
    	let current;

    	select = new Select({
    			props: {
    				field: /*field*/ ctx[0],
    				onChange: /*onChange*/ ctx[1]
    			}
    		});

    	return {
    		c() {
    			create_component(select.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(select, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const select_changes = {};
    			if (dirty & /*field*/ 1) select_changes.field = /*field*/ ctx[0];
    			if (dirty & /*onChange*/ 2) select_changes.onChange = /*onChange*/ ctx[1];
    			select.$set(select_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(select.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(select.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(select, detaching);
    		}
    	};
    }

    // (30:28) 
    function create_if_block_7(ctx) {
    	let textarea;
    	let current;

    	textarea = new Textarea({
    			props: {
    				field: /*field*/ ctx[0],
    				onChange: /*onChange*/ ctx[1]
    			}
    		});

    	return {
    		c() {
    			create_component(textarea.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(textarea, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const textarea_changes = {};
    			if (dirty & /*field*/ 1) textarea_changes.field = /*field*/ ctx[0];
    			if (dirty & /*onChange*/ 2) textarea_changes.onChange = /*onChange*/ ctx[1];
    			textarea.$set(textarea_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(textarea.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(textarea.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(textarea, detaching);
    		}
    	};
    }

    // (28:25) 
    function create_if_block_6(ctx) {
    	let range;
    	let current;

    	range = new Range({
    			props: {
    				field: /*field*/ ctx[0],
    				onChange: /*onChange*/ ctx[1]
    			}
    		});

    	return {
    		c() {
    			create_component(range.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(range, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const range_changes = {};
    			if (dirty & /*field*/ 1) range_changes.field = /*field*/ ctx[0];
    			if (dirty & /*onChange*/ 2) range_changes.onChange = /*onChange*/ ctx[1];
    			range.$set(range_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(range.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(range.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(range, detaching);
    		}
    	};
    }

    // (26:25) 
    function create_if_block_5(ctx) {
    	let radio;
    	let current;

    	radio = new Radio({
    			props: {
    				field: /*field*/ ctx[0],
    				onChange: /*onChange*/ ctx[1]
    			}
    		});

    	return {
    		c() {
    			create_component(radio.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(radio, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const radio_changes = {};
    			if (dirty & /*field*/ 1) radio_changes.field = /*field*/ ctx[0];
    			if (dirty & /*onChange*/ 2) radio_changes.onChange = /*onChange*/ ctx[1];
    			radio.$set(radio_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(radio.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(radio.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(radio, detaching);
    		}
    	};
    }

    // (24:26) 
    function create_if_block_4(ctx) {
    	let number;
    	let current;

    	number = new Number_1({
    			props: {
    				field: /*field*/ ctx[0],
    				onChange: /*onChange*/ ctx[1]
    			}
    		});

    	return {
    		c() {
    			create_component(number.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(number, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const number_changes = {};
    			if (dirty & /*field*/ 1) number_changes.field = /*field*/ ctx[0];
    			if (dirty & /*onChange*/ 2) number_changes.onChange = /*onChange*/ ctx[1];
    			number.$set(number_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(number.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(number.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(number, detaching);
    		}
    	};
    }

    // (22:29) 
    function create_if_block_3(ctx) {
    	let text_1;
    	let current;

    	text_1 = new Text({
    			props: {
    				field: /*field*/ ctx[0],
    				onChange: /*onChange*/ ctx[1]
    			}
    		});

    	return {
    		c() {
    			create_component(text_1.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(text_1, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const text_1_changes = {};
    			if (dirty & /*field*/ 1) text_1_changes.field = /*field*/ ctx[0];
    			if (dirty & /*onChange*/ 2) text_1_changes.onChange = /*onChange*/ ctx[1];
    			text_1.$set(text_1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(text_1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(text_1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(text_1, detaching);
    		}
    	};
    }

    // (20:24) 
    function create_if_block_2(ctx) {
    	let date;
    	let current;

    	date = new Date({
    			props: {
    				field: /*field*/ ctx[0],
    				onChange: /*onChange*/ ctx[1]
    			}
    		});

    	return {
    		c() {
    			create_component(date.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(date, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const date_changes = {};
    			if (dirty & /*field*/ 1) date_changes.field = /*field*/ ctx[0];
    			if (dirty & /*onChange*/ 2) date_changes.onChange = /*onChange*/ ctx[1];
    			date.$set(date_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(date.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(date.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(date, detaching);
    		}
    	};
    }

    // (18:25) 
    function create_if_block_1(ctx) {
    	let color;
    	let current;

    	color = new Color({
    			props: {
    				field: /*field*/ ctx[0],
    				onChange: /*onChange*/ ctx[1]
    			}
    		});

    	return {
    		c() {
    			create_component(color.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(color, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const color_changes = {};
    			if (dirty & /*field*/ 1) color_changes.field = /*field*/ ctx[0];
    			if (dirty & /*onChange*/ 2) color_changes.onChange = /*onChange*/ ctx[1];
    			color.$set(color_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(color.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(color.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(color, detaching);
    		}
    	};
    }

    // (16:0) {#if isCheckbox(field)}
    function create_if_block$3(ctx) {
    	let checkbox;
    	let current;

    	checkbox = new Checkbox({
    			props: {
    				field: /*field*/ ctx[0],
    				onChange: /*onChange*/ ctx[1]
    			}
    		});

    	return {
    		c() {
    			create_component(checkbox.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(checkbox, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const checkbox_changes = {};
    			if (dirty & /*field*/ 1) checkbox_changes.field = /*field*/ ctx[0];
    			if (dirty & /*onChange*/ 2) checkbox_changes.onChange = /*onChange*/ ctx[1];
    			checkbox.$set(checkbox_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(checkbox.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(checkbox.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(checkbox, detaching);
    		}
    	};
    }

    function create_fragment$9(ctx) {
    	let show_if;
    	let show_if_1;
    	let show_if_2;
    	let show_if_3;
    	let show_if_4;
    	let show_if_5;
    	let show_if_6;
    	let show_if_7;
    	let show_if_8;
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;

    	const if_block_creators = [
    		create_if_block$3,
    		create_if_block_1,
    		create_if_block_2,
    		create_if_block_3,
    		create_if_block_4,
    		create_if_block_5,
    		create_if_block_6,
    		create_if_block_7,
    		create_if_block_8
    	];

    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (dirty & /*field*/ 1) show_if = !!isCheckbox(/*field*/ ctx[0]);
    		if (show_if) return 0;
    		if (dirty & /*field*/ 1) show_if_1 = !!isColor(/*field*/ ctx[0]);
    		if (show_if_1) return 1;
    		if (dirty & /*field*/ 1) show_if_2 = !!isDate(/*field*/ ctx[0]);
    		if (show_if_2) return 2;
    		if (dirty & /*field*/ 1) show_if_3 = !!isTextField(/*field*/ ctx[0]);
    		if (show_if_3) return 3;
    		if (dirty & /*field*/ 1) show_if_4 = !!isNumber(/*field*/ ctx[0]);
    		if (show_if_4) return 4;
    		if (dirty & /*field*/ 1) show_if_5 = !!isRadio(/*field*/ ctx[0]);
    		if (show_if_5) return 5;
    		if (dirty & /*field*/ 1) show_if_6 = !!isRange(/*field*/ ctx[0]);
    		if (show_if_6) return 6;
    		if (dirty & /*field*/ 1) show_if_7 = !!isTextarea(/*field*/ ctx[0]);
    		if (show_if_7) return 7;
    		if (dirty & /*field*/ 1) show_if_8 = !!isSelect(/*field*/ ctx[0]);
    		if (show_if_8) return 8;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx, -1))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(target, anchor);
    			}

    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx, dirty);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					}

    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d(detaching);
    			}

    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$9($$self, $$props, $$invalidate) {
    	
    	let { field } = $$props;
    	let { onChange } = $$props;

    	$$self.$$set = $$props => {
    		if ("field" in $$props) $$invalidate(0, field = $$props.field);
    		if ("onChange" in $$props) $$invalidate(1, onChange = $$props.onChange);
    	};

    	return [field, onChange];
    }

    class Field extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { field: 0, onChange: 1 });
    	}
    }

    /* src/App.svelte generated by Svelte v3.29.0 */

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (44:1) {#each fields as field}
    function create_each_block$2(ctx) {
    	let renderfield;
    	let current;

    	renderfield = new Field({
    			props: {
    				field: /*field*/ ctx[6],
    				onChange: /*setData*/ ctx[3]
    			}
    		});

    	return {
    		c() {
    			create_component(renderfield.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(renderfield, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const renderfield_changes = {};
    			if (dirty & /*fields*/ 2) renderfield_changes.field = /*field*/ ctx[6];
    			renderfield.$set(renderfield_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(renderfield.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(renderfield.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(renderfield, detaching);
    		}
    	};
    }

    // (50:1) {#if message}
    function create_if_block$4(ctx) {
    	let p;
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text(/*message*/ ctx[2]);
    			attr(p, "class", "submit-message");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*message*/ 4) set_data(t, /*message*/ ctx[2]);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment$a(ctx) {
    	let form;
    	let t0;
    	let div;
    	let input;
    	let input_label_value;
    	let t1;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*fields*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let if_block = /*message*/ ctx[2] && create_if_block$4(ctx);

    	return {
    		c() {
    			form = element("form");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			div = element("div");
    			input = element("input");
    			t1 = space();
    			if (if_block) if_block.c();
    			attr(input, "type", "submit");
    			attr(input, "label", input_label_value = /*submit*/ ctx[0]?.buttonLabel);
    			attr(div, "class", "field submit-field");
    		},
    		m(target, anchor) {
    			insert(target, form, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(form, null);
    			}

    			append(form, t0);
    			append(form, div);
    			append(div, input);
    			append(form, t1);
    			if (if_block) if_block.m(form, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen(form, "submit", /*onSubmit*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*fields, setData*/ 10) {
    				each_value = /*fields*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(form, t0);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty & /*submit*/ 1 && input_label_value !== (input_label_value = /*submit*/ ctx[0]?.buttonLabel)) {
    				attr(input, "label", input_label_value);
    			}

    			if (/*message*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					if_block.m(form, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(form);
    			destroy_each(each_blocks, detaching);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$a($$self, $$props, $$invalidate) {
    	
    	
    	let { submit } = $$props;
    	let { fields = [] } = $$props;
    	let message;
    	let data = getInitialData(fields);

    	const setData = (key, value) => {
    		data = Object.assign(Object.assign({}, data), { [key]: value });
    	};

    	const onSubmit = e => {
    		e.preventDefault();

    		if (e.currentTarget.checkValidity() && submit) {
    			const { loadingMessage } = submit;

    			if (loadingMessage) {
    				$$invalidate(2, message = loadingMessage);
    			}

    			request(data, submit).then(() => {
    				const { successMessage, successRedirectUrl } = submit;

    				if (successMessage) {
    					$$invalidate(2, message = successMessage);
    				}

    				if (successRedirectUrl) {
    					window.location.assign(successRedirectUrl);
    				}
    			}).catch(err => {
    				const { errorMessage, errorRedirectUrl } = submit;
    				console.log(err, errorMessage);

    				if (errorMessage) {
    					$$invalidate(2, message = errorMessage);
    				}

    				if (errorRedirectUrl) {
    					window.location.assign(errorRedirectUrl);
    				}
    			});
    		}
    	};

    	$$self.$$set = $$props => {
    		if ("submit" in $$props) $$invalidate(0, submit = $$props.submit);
    		if ("fields" in $$props) $$invalidate(1, fields = $$props.fields);
    	};

    	return [submit, fields, message, setData, onSubmit];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { submit: 0, fields: 1 });
    	}
    }

    const form = (target, props) => new App({ target, props });

    return form;

})));
