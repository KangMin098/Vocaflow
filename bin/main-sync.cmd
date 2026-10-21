@echo off
rem bin/main-sync.cmd — Windows 작업 스케줄러(VocaflowMainSync)가 매일 부르는 래퍼. 본체는 bin/main-sync.mjs
cd /d D:\workspace\Vocaflow-AI-Control
if not exist runtime mkdir runtime
node bin\main-sync.mjs >> runtime\main-sync.log 2>&1
