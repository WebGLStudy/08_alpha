(function(){
    'use strict';

    const VOLUME_PLANES = 200;

    // 変数
    var gl, canvas;
    var message;

    window.addEventListener('load', function(){
        ////////////////////////////
        // 初期化
        ////////////////////////////
        
        message = document.getElementById('message');
        
        // canvas の初期化
        canvas = document.getElementById('canvas');
        canvas.width = 512;
        canvas.height = 512;

        // WeebGLの初期化(WebGL 2.0)
        gl = canvas.getContext('webgl2');

        // シェーダプログラムの初期化
        // 頂点シェーダ
        var vsSource = [
            '#version 300 es',
            'in vec3 position;',
            'in vec4 color;',
            
            'uniform mat4 mwMatrix;',
            'uniform mat4 mpvMatrix;',
            
            'out vec4 vColor;',

            'void main(void) {',
                'gl_Position = mpvMatrix * mwMatrix * vec4(position, 1.0);',
                'vColor = color;',
            '}'
        ].join('\n');

        var vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vsSource);
        gl.compileShader(vertexShader);
        if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)){
            alert(gl.getShaderInfoLog(vertexShader));
        }

        // フラグメントシェーダ
        var fsSource = [
            '#version 300 es',
            'precision highp float;',
            
            'in vec4 vColor;',
            
            'out vec4 outColor;',

            'void main(void) {',
                'outColor = vColor;',
            '}'
        ].join('\n');

        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fsSource);
        gl.compileShader(fragmentShader);
        if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)){
            alert(gl.getShaderInfoLog(fragmentShader));
        }

        // シェーダ「プログラム」の初期化
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
            alert(gl.getProgramInfoLog(program));
            return;
        }
        // Uniform 変数の情報の取得
        var uniLocations = [];
        uniLocations[0]  = gl.getUniformLocation(program, 'mwMatrix');
        uniLocations[1]  = gl.getUniformLocation(program, 'mpvMatrix');
        
        gl.useProgram(program);

        // モデルの構築
        var vao_plane = createPlane(gl, program);// 平面
        var vao_volume = createVolume(gl, program);// 半透明群
        
        // シーンの情報の設定
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        window.requestAnimationFrame(update);
        
        ////////////////////////////
        // フレームの更新
        ////////////////////////////
        var lastTime = null;
        var elapsedTime_ring_buffer = [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0];
        var ring_buffer_index = 0;
        var angle = 0.0;// 物体を動かす角度

        // 射影行列の生成
        var mat = new matIV();// 行列のシステムのオブジェクト
        var pMatrix   = mat.identity(mat.create());// 射影行列
        mat.perspective(40, canvas.width / canvas.height, 0.01, 10.0, pMatrix);// 射影行列の生成

        function update(timestamp){
            // 更新間隔の取得
            var elapsedTime = lastTime ? timestamp - lastTime : 0;
            lastTime = timestamp;

            ////////////////////////////
            // 動かす
            ////////////////////////////
            
            // カメラを回すパラメータ
            angle += 0.0001 * elapsedTime;
            if(1.0 < angle) angle -= 1.0;

            // ワールド行列の生成
            var wMatrixIdentity   = mat.identity(mat.create());
            var wMatrixVolume   = mat.create();
            mat.translate(wMatrixIdentity, [0.0, 0.0, -Math.sin(2.0 * Math.PI * angle)], wMatrixVolume);

            // ビュー行列の生成
            var camera_pos = [0.0, 0.0, -5.0];
            var look_at = [0.0, 0.0, 0.0];
            var up = [0.0, 1.0, 0.0];
            var vMatrix = mat.create();
            mat.lookAt(camera_pos, look_at, up, vMatrix);
            // ビュー射影行列の生成
            var pvMatrix = mat.create();
            mat.multiply (pMatrix, vMatrix, pvMatrix);
            
            ////////////////////////////
            // 描画
            ////////////////////////////
            // 画面クリア
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clearDepth(1.0);// 初期設定する深度値(一番奥の深度)
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            
            // モデル描画
            gl.disable(gl.BLEND); // 不透明設定
            gl.uniformMatrix4fv(uniLocations[1], false, pvMatrix);// ビュー射影行列の設定
            // 平面
            gl.uniformMatrix4fv(uniLocations[0], false, wMatrixIdentity);// ワールド行列の設定
            gl.bindVertexArray(vao_plane);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_BYTE, 0);// 2セットの3角形ポリゴンによる平面が6つ
            // 半透明群
            gl.enable(gl.BLEND); // 半透明の設定
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);       
            gl.uniformMatrix4fv(uniLocations[0], false, wMatrixVolume);// ワールド行列の設定
            gl.bindVertexArray(vao_volume);
            gl.drawElements(gl.TRIANGLES, 6 * VOLUME_PLANES, gl.UNSIGNED_SHORT, 0);// 平面の集合
            
            gl.flush();// 画面更新
            
            // 平均時間を使ったFPS表示
            elapsedTime_ring_buffer[ring_buffer_index] = elapsedTime;
            var n = elapsedTime_ring_buffer.length
            ring_buffer_index = (ring_buffer_index + 1) % n;
            var average_elapsedTime = 0.0;
            elapsedTime_ring_buffer.forEach(function( t ) {
                average_elapsedTime += t;
            });
            average_elapsedTime /= n;
            message.innerText  = (1000.0/average_elapsedTime).toFixed(2) + "fps";

            // ブラウザに再描画時にアニメーションの更新を要求
            window.requestAnimationFrame(update);
        }
        
    }, false);

    // 平面モデルの生成
    function createPlane(gl, program) {
        var vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        var vertex_data = new Float32Array([
         // x     y     z      R   G   B  alpha
          -1.2, -1.2,  0.0,    0,  0, 0.3,  1.0,
          -1.2, +1.2,  0.0,    0,  0, 0.3,  1.0,
          +1.2, -1.2,  0.0,    0,  0, 0.3,  1.0,
          +1.2, +1.2,  0.0,    0,  0, 0.3,  1.0,
        ]);

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertex_data, gl.STATIC_DRAW);

        var posAttr = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(posAttr);
        gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, 4*7, 0);

        var colAttr = gl.getAttribLocation(program, 'color');
        gl.enableVertexAttribArray(colAttr);
        gl.vertexAttribPointer(colAttr, 4, gl.FLOAT, false, 4*7, 4*3);

        var index_data = new Uint8Array([
          0,  1,  2,   3,  2,  1,
        ]);
        var indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index_data, gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        return vao;
    };

    // ボリュームモデルの生成
    function createVolume(gl, program) {
        var vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        var vertex_data = [];
        var index_data = [];

        var idx_start = 0;
        for (var i = 0; i < VOLUME_PLANES; i++) {
            // vertex
            var z = 1.0 - 2.0 * i / (VOLUME_PLANES-1.0);
            for(var v = 0; v < 4; v++){
                vertex_data.push(((v>>1)&1) ? +1.0 : -1.0);
                vertex_data.push((v&1) ? +1.0 : -1.0);
                vertex_data.push(z);

                vertex_data.push(1.0);// R
                vertex_data.push(1.0);// G
                vertex_data.push(1.0);// B
                vertex_data.push(1.0/255.0);// alpha
            }

            // index
            index_data.push(idx_start + 0);
            index_data.push(idx_start + 1);
            index_data.push(idx_start + 2);

            index_data.push(idx_start + 3);
            index_data.push(idx_start + 2);
            index_data.push(idx_start + 1);
            idx_start += 4;
        }
   
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertex_data), gl.STATIC_DRAW);

        var posAttr = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(posAttr);
        gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, 4*7, 0);

        var colAttr = gl.getAttribLocation(program, 'color');
        gl.enableVertexAttribArray(colAttr);
        gl.vertexAttribPointer(colAttr, 4, gl.FLOAT, false, 4*7, 4*3);

        var indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index_data), gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        return vao;
    };

})();
