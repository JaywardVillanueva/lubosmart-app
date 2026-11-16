<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class PipelineDemoTest extends TestCase
{
    public function test_pipeline_message(): void
    {
        $message = 'LubosMart pipeline OK';
        $this->assertSame('WRONG MESSAGE', $message);
    }
}
