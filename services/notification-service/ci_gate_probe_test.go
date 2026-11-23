package main

import "testing"

func TestCIGateFailureProbe(t *testing.T) {
	t.Fatal("intentional failure to verify the required CI Gate")
}
