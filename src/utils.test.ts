import { findTagEnd, interpolateString, interpolateValue, parseTags } from '../src/utils';

describe('Templating', function () {
  describe('parseTags', function () {
    it('simple example', function () {
      const example =
        'this is a {% foo blah="asdf" %}test{% /foo %} of template parsing';
      const output = parseTags(example);
      const expected = [
        { type: 'text', content: 'this is a ', start: 0, end: 9 },
        {
          type: 'tag_open',
          info: '{% foo blah="asdf" %}',
          start: 10,
          end: 30,
          nesting: 1,
          meta: {
            tag: 'foo',
            attributes: [{ name: 'blah', type: 'attribute', value: 'asdf' }],
          },
        },
        { type: 'text', content: 'test', start: 31, end: 34 },
        {
          type: 'tag_close',
          nesting: -1,
          meta: { tag: 'foo' },
          info: '{% /foo %}',
          start: 35,
          end: 44,
        },
        { type: 'text', content: ' of template parsing', start: 45, end: 64 },
      ];

      expect(output).toDeepEqualSubset(expected);
    });
  });

  describe('findTagEnd', function () {
    describe('inline tags', function () {
      it('in a heading', function () {
        const example = `# Testing {% #foo.bar baz=1 %}`;
        const end = findTagEnd(example, 0);
        expect(end).toEqual(28);
        expect(example[end]).toEqual('%');
      });

      it('with string', function () {
        const example = `# Testing {% #foo.bar baz="example" test=true %}`;
        const end = findTagEnd(example, 0);
        expect(end).toEqual(46);
        expect(example[end]).toEqual('%');
      });

      it('with object literal attribute value', function () {
        const example = `# Testing {% #foo.bar baz={test: 1, foo: {test: "asdf{"}} %}`;
        const end = findTagEnd(example, 0);
        expect(end).toEqual(58);
        expect(example[end]).toEqual('%');
      });

      it('in a simple container', function () {
        const end = findTagEnd('{% foo %}');
        expect(end).toEqual(7);
      });

      it('in a container with shortcuts', function () {
        const end = findTagEnd('{% foo .bar.baz#test %}');
        expect(end).toEqual(21);
      });

      it('in a container with a string attribute', function () {
        const end = findTagEnd('{% foo test="this is a test" %}');
        expect(end).toEqual(29);
      });

      it('for an invalid container', function () {
        const end = findTagEnd('{% foo .bar#baz');
        expect(end).toBeUndefined;
      });

      it('in a complex container', function () {
        const end = findTagEnd(
          '{% #foo .bar .baz test="this} is \\"{test}\\" a test" %} this is a test'
        );
        expect(end).toEqual(52);
      });
    });

    describe('multiline tags', function () {
      it('simple', function () {
        const example = `
        {% test #foo.bar
              baz=1 %}
        `;

        const end = findTagEnd(example, 0);
        expect(end).toEqual(46);
        expect(example[end]).toEqual('%');
      });

      it('with string', function () {
        const example = `
        {% test #foo.bar
              baz="this is a test"
              example=1 %}
        `;

        const end = findTagEnd(example, 0);
        expect(end).toEqual(85);
        expect(example[end]).toEqual('%');
      });

      it('with string and escaped quote', function () {
        const example = `
        {% test #foo.bar
              baz="this \\"is a test"
              example=1 %}
        `;

        const end = findTagEnd(example, 0);
        expect(end).toEqual(87);
        expect(example[end]).toEqual('%');
      });

      it('with string that has an opening brace', function () {
        const example = `
        {% test #foo.bar
              baz="this {is a test"
              example=1 %}
        `;

        const end = findTagEnd(example, 0);
        expect(end).toEqual(86);
        expect(example[end]).toEqual('%');
      });

      it('with string that has escapes and braces', function () {
        const example = `
        {% test #foo.bar
              baz="th\\"is {is a \\\\te\\"st"
              example=1 %}
        `;

        const end = findTagEnd(example, 0);
        expect(end).toEqual(92);
        expect(example[end]).toEqual('%');
      });

      it('with an object literal attribute value', function () {
        const example = `
        {% test #foo.bar
              foo={testing: "this } is a test", bar: {baz: 1}}
              example=1 another="test}" %}
        `;

        const end = findTagEnd(example, 0);
        expect(end).toEqual(129);
        expect(example[end]).toEqual('%');
      });

      it('with an invalid object literal attribute value', function () {
        const example = `
        {test #foo.bar
              foo={testing: "this } is a test", bar: {baz: 1}
              example=1 another="test}"}
        `;

        const end = findTagEnd(example, 0);
        expect(end).toEqual(null);
      });
    });
    it("shouldn't hang when {% is included in code block", () => {
      const example = '```\n{%a %b %c}\n```';

      const output = parseTags(example);
      expect(output).toEqual([
        {
          type: 'text',
          start: 0,
          end: 17,
          content: '```\n{%a %b %c}\n```',
        },
      ]);
    });
  });

  describe('interpolateString', function () {
    it('should interpolate a simple variable', function () {
      const example = 'foo {{$bar }}';
      const output = interpolateString(example, { bar: 'test' });
      expect(output.result).toEqual('foo test');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should interpolate a variable with a dot', function () {
      const example = 'foo {{$bar.baz }}';
      const output = interpolateString(example, { bar: { baz: 'test' } });
      expect(output.result).toEqual('foo test');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle malformed interpolation syntax', function () {
      const example = 'foo {{ $bar';
      const output = interpolateString(example, { bar: 'test' });
      expect(output.result).toEqual('foo {{ $bar');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should not support nested interpolation', function () {
      const example = 'foo {{ $bar }}';
      const output = interpolateString(example, { bar: '{{ nested }}' });
      expect(output.result).toEqual('foo {{ nested }}');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle escaped interpolation', function () {
      const example = 'foo \\{{ $bar }}';
      const output = interpolateString(example, { bar: 'test' });
      expect(output.result).toEqual('foo \\{{ $bar }}');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle unicode variable names', function () {
      const example = 'Hello {{ $变量 }}';
      const output = interpolateString(example, { '变量': '中文' });
      expect(output.result).toEqual('Hello 中文');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should support array access', function () {
      const example = 'foo {{ $arr[0] }}';
      const output = interpolateString(example, { arr: ['a', 'b', 'c'] });
      expect(output.result).toEqual('foo a');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should support getting a key from an array element', function () {
      const example = 'foo {{ $arr[1].key }}';
      const output = interpolateString(example, { arr: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] });
      expect(output.result).toEqual('foo b');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should support getting a deep item from a mixed array and object', function () {
      const example = 'foo {{ $arr[1].obj.key[2].deep }}';
      const output = interpolateString(example, { arr: [{ obj: { key: ['a', 'b', { deep: 'c' }] } }, { obj: { key: ['d', 'e', { deep: 'f' }] } }, { obj: { key: ['g', 'h', { deep: 'i' }] } }] });
      expect(output.result).toEqual('foo f');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle object with toString method', function () {
      const example = 'Object: {{ $obj }}';
      const output = interpolateString(example, { 
        obj: { toString: () => 'custom object' } 
      });
      expect(output.result).toEqual('Object: custom object');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle null and undefined values', function () {
      const example = 'Null: {{ $nullVal }}, Undefined: {{ $undefinedVal }}, Empty: {{ $emptyStr }}';
      const output = interpolateString(example, { 
        nullVal: null, 
        undefinedVal: undefined, 
        emptyStr: '' 
      });
      expect(output.result).toEqual('Null: , Undefined: , Empty: ');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle very deep nesting', function () {
      const example = '{{ $level1.level2.level3.level4.level5 }}';
      const output = interpolateString(example, { 
        level1: { 
          level2: { 
            level3: { 
              level4: { 
                level5: 'deep' 
              } 
            } 
          } 
        } 
      });
      expect(output.result).toEqual('deep');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle partial path failure', function () {
      const example = '{{ $level1.level2.level3.level4 }}';
      const output = interpolateString(example, { 
        level1: { 
          level2: { 
            level3: 'exists' 
          } 
        } 
      });
      expect(output.result).toEqual('{{ $level1.level2.level3.level4 }}');
      expect(output.undefinedVariables).toEqual(['level1.level2.level3.level4']);
    });

    it('should handle empty interpolation', function () {
      const example = 'foo {{$}}';
      const output = interpolateString(example, { foo: 'test' });
      expect(output.result).toEqual('foo {{$}}');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle whitespace only in interpolation', function () {
      const example = 'foo {{$   }}';
      const output = interpolateString(example, { foo: 'test' });
      expect(output.result).toEqual('foo {{$   }}');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle special characters in variable names', function () {
      const example = '{{ $user-name }} {{ $user_name }} {{ $user123 }}';
      const output = interpolateString(example, { 
        'user-name': 'john',
        'user_name': 'jane',
        'user123': 'test'
      });
      expect(output.result).toEqual('john jane test');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle very long variable names', function () {
      const example = '{{ $very_long_variable_name_that_exceeds_normal_length_limits }}';
      const output = interpolateString(example, { 
        'very_long_variable_name_that_exceeds_normal_length_limits': 'long' 
      });
      expect(output.result).toEqual('long');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should not support numbers as variable names', function () {
      const example = '{{ $123 }}';
      const output = interpolateString(example, { '123': 'number' });
      expect(output.result).toEqual('{{ $123 }}');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle boolean values', function () {
      const example = 'True: {{ $trueVal }}, False: {{ $falseVal }}';
      const output = interpolateString(example, { 
        trueVal: true, 
        falseVal: false 
      });
      expect(output.result).toEqual('True: true, False: false');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle number values', function () {
      const example = 'Int: {{ $intVal }}, Float: {{ $floatVal }}, Zero: {{ $zeroVal }}, Neg: {{ $negVal }}';
      const output = interpolateString(example, { 
        intVal: 42, 
        floatVal: 3.14, 
        zeroVal: 0, 
        negVal: -1 
      });
      expect(output.result).toEqual('Int: 42, Float: 3.14, Zero: 0, Neg: -1');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle multiple interpolations in one string', function () {
      const example = '{{ $a }} {{ $b }} {{ $c }}';
      const output = interpolateString(example, { 
        a: 'first', 
        b: 'second', 
        c: 'third' 
      });
      expect(output.result).toEqual('first second third');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle interpolation at string boundaries', function () {
      const example = '{{ $start }}middle{{ $end }}';
      const output = interpolateString(example, { 
        start: 'begin', 
        end: 'finish' 
      });
      expect(output.result).toEqual('beginmiddlefinish');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle empty variables object', function () {
      const example = 'Hello {{ $name }}';
      const output = interpolateString(example, {});
      expect(output.result).toEqual('Hello {{ $name }}');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle null variables object', function () {
      const example = 'Hello {{ $name }}';
      const output = interpolateString(example, null as any);
      expect(output.result).toEqual('Hello {{ $name }}');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should handle undefined variables object', function () {
      const example = 'Hello {{ $name }}';
      const output = interpolateString(example, undefined);
      expect(output.result).toEqual('Hello {{ $name }}');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should track undefined variables correctly', function () {
      const example = 'Hello {{ $defined }} {{ $undefined1 }} {{ $defined2 }} {{ $undefined2 }}';
      const output = interpolateString(example, { 
        defined: 'exists',
        defined2: 'also exists'
      });
      expect(output.result).toEqual('Hello exists {{ $undefined1 }} also exists {{ $undefined2 }}');
      expect(output.undefinedVariables).toEqual(['undefined1', 'undefined2']);
    });

    it('should not interpolate variables without $ prefix', function () {
      const example = 'Hello {{ name }} and {{ $name }}';
      const output = interpolateString(example, { name: 'World' });
      expect(output.result).toEqual('Hello {{ name }} and World');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should not interpolate nested variables without $ prefix', function () {
      const example = 'Hello {{ user.name }} and {{ $user.name }}';
      const output = interpolateString(example, { user: { name: 'John' } });
      expect(output.result).toEqual('Hello {{ user.name }} and John');
      expect(output.undefinedVariables).toEqual([]);
    });

    it('should not interpolate mixed syntax', function () {
      const example = 'Hello {{ name }} {{ $name }} {{ $user.name }} {{ user.name }}';
      const output = interpolateString(example, { 
        name: 'World',
        user: { name: 'John' }
      });
      expect(output.result).toEqual('Hello {{ name }} World John {{ user.name }}');
      expect(output.undefinedVariables).toEqual([]);
    });
  });

  describe('interpolateValue', function () {
    it('should interpolate string values', function () {
      const value = 'Hello {{$name}}';
      const variables = { name: 'World' };
      const result = interpolateValue(value, variables);
      expect(result).toEqual('Hello World');
    });

    it('should interpolate array values', function () {
      const value = ['Hello {{$name}}', '{{$greeting}}', '{{$site.name}}'];
      const variables = { 
        name: 'World', 
        greeting: 'Hi', 
        site: { name: 'Markdoc' } 
      };
      const result = interpolateValue(value, variables);
      expect(result).toEqual(['Hello World', 'Hi', 'Markdoc']);
    });

    it('should interpolate object values', function () {
      const value = {
        title: 'Hello {{$name}}',
        metadata: {
          author: '{{$author}}',
          site: '{{$site.name}}'
        }
      };
      const variables = { 
        name: 'World', 
        author: 'John Doe', 
        site: { name: 'Markdoc' } 
      };
      const result = interpolateValue(value, variables);
      expect(result).toEqual({
        title: 'Hello World',
        metadata: {
          author: 'John Doe',
          site: 'Markdoc'
        }
      });
    });

    it('should handle nested arrays and objects', function () {
      const value = {
        items: [
          { name: '{{$item1}}', value: '{{$val1}}' },
          { name: '{{$item2}}', value: '{{$val2}}' }
        ],
        summary: '{{$total}} items'
      };
      const variables = { 
        item1: 'First', 
        val1: '1', 
        item2: 'Second', 
        val2: '2', 
        total: '2' 
      };
      const result = interpolateValue(value, variables);
      expect(result).toEqual({
        items: [
          { name: 'First', value: '1' },
          { name: 'Second', value: '2' }
        ],
        summary: '2 items'
      });
    });

    it('should handle non-string values unchanged', function () {
      const value = {
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { key: 'value' }
      };
      const variables = { name: 'World' };
      const result = interpolateValue(value, variables);
      expect(result).toEqual(value);
    });

    it('should handle undefined variables gracefully', function () {
      const value = {
        title: 'Hello {{$name}}',
        missing: '{{$undefined}}'
      };
      const variables = { name: 'World' };
      const result = interpolateValue(value, variables);
      expect(result).toEqual({
        title: 'Hello World',
        missing: '{{$undefined}}'
      });
    });

    it('should handle empty variables object', function () {
      const value = {
        title: 'Hello {{$name}}',
        items: ['{{$item1}}', '{{$item2}}']
      };
      const result = interpolateValue(value, {});
      expect(result).toEqual({
        title: 'Hello {{$name}}',
        items: ['{{$item1}}', '{{$item2}}']
      });
    });
  });
});
