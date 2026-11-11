<?php

use Illuminate\Foundation\Console\ServeCommand;
use Tests\TestCase;

uses(TestCase::class);

it('passes the temp folder to the dev server so large imports are not discarded', function () {
    expect(ServeCommand::$passthroughVariables)->toContain('TEMP', 'TMP', 'PATH');
});
